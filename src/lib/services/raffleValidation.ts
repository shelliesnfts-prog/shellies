// Raffle validation service - comprehensive application-level validation

import { supabase } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';

// Create a service role client that bypasses RLS
const supabaseService = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);
import { ValidationError, NotFoundError, ERROR_CODES } from '@/lib/errors';

export interface RaffleData {
  id: number;
  title: string;
  points_per_ticket: number;
  max_tickets_per_user: number;
  end_date: string;
}

export interface UserData {
  id: string;
  wallet_address: string;
  points: number;
}

export interface UserEntry {
  ticket_count: number;
  points_spent: number;
}

export interface ValidationResult {
  raffle: RaffleData;
  user: UserData;
  userEntry: UserEntry | null;
  totalCost: number;
  remainingTickets: number;
}

export class RaffleValidationService {
  
  /**
   * Comprehensive validation for raffle entry (optimized)
   */
  static async validateRaffleEntry(
    raffleId: number | string, 
    ticketCount: number, 
    walletAddress: string
  ): Promise<ValidationResult> {
    
    // Step 1: Validate input parameters
    this.validateInputParameters(raffleId, ticketCount, walletAddress);
    
    // Step 2: Fetch all data in a single optimized query
    const [raffle, user, userEntry] = await Promise.all([
      this.getRaffleData(raffleId),
      this.getUserData(walletAddress),
      this.getUserEntry(walletAddress, raffleId)
    ]);
    
    // Step 3: Validate raffle status
    this.validateRaffleStatus(raffle);
    
    // Step 4: Calculate costs and limits
    const totalCost = raffle.points_per_ticket * ticketCount;
    const currentTickets = userEntry?.ticket_count || 0;
    const newTotalTickets = currentTickets + ticketCount;
    const remainingTickets = raffle.max_tickets_per_user - currentTickets;
    
    // Step 5: Validate user eligibility
    this.validateUserEligibility(user, totalCost);
    
    // Step 6: Validate ticket limits
    this.validateTicketLimits(ticketCount, newTotalTickets, raffle.max_tickets_per_user, remainingTickets);
    
    return {
      raffle,
      user,
      userEntry,
      totalCost,
      remainingTickets
    };
  }

  /**
   * Validate input parameters
   */
  private static validateInputParameters(raffleId: number | string, ticketCount: number, walletAddress: string) {
    const parsedRaffleId = typeof raffleId === 'string' ? parseInt(raffleId, 10) : raffleId;
    if (!parsedRaffleId || !Number.isInteger(parsedRaffleId) || parsedRaffleId <= 0) {
      throw new ValidationError('Valid Raffle ID is required', ERROR_CODES.INVALID_REQUEST);
    }

    if (!Number.isInteger(ticketCount) || ticketCount <= 0) {
      throw new ValidationError('Ticket count must be a positive integer', ERROR_CODES.INVALID_TICKET_COUNT);
    }

    // More flexible wallet address validation (case-insensitive)
    if (!walletAddress || !walletAddress.match(/^0x[a-fA-F0-9]{40}$/i)) {
      throw new ValidationError('Invalid wallet address format', ERROR_CODES.INVALID_REQUEST);
    }
  }

  /**
   * Fetch raffle data from database
   */
  private static async getRaffleData(raffleId: number | string): Promise<RaffleData> {
    const parsedRaffleId = typeof raffleId === 'string' ? parseInt(raffleId, 10) : raffleId;
    const { data: raffle, error } = await supabaseService
      .from('shellies_raffle_raffles')
      .select('id, title, points_per_ticket, max_tickets_per_user, end_date')
      .eq('id', parsedRaffleId)
      .single();

    if (error || !raffle) {
      console.error('Raffle lookup failed:', { raffleId: parsedRaffleId, error });
      throw new NotFoundError('Raffle not found', ERROR_CODES.RAFFLE_NOT_FOUND);
    }

    return raffle;
  }

  /**
   * Fetch user data from database
   */
  private static async getUserData(walletAddress: string): Promise<UserData> {
    console.log('Looking up user with wallet address:', walletAddress);
    
    // Use service client to bypass RLS policies
    const { data: user, error } = await supabaseService
      .from('shellies_raffle_users')
      .select('id, wallet_address, points')
      .eq('wallet_address', walletAddress)
      .single();

    if (error || !user) {
      console.error('User lookup failed:', { walletAddress, error });
      
      // Debug: Try to fetch some users to verify connection
      const { data: sampleUsers, error: sampleError } = await supabaseService
        .from('shellies_raffle_users')
        .select('wallet_address')
        .limit(3);
      
      console.log('Debug - Sample users:', sampleUsers?.map(u => u.wallet_address), 'Error:', sampleError);
      
      throw new NotFoundError('User not found. Please connect your wallet first.', ERROR_CODES.USER_NOT_FOUND);
    }

    console.log('Successfully found user:', { id: user.id, points: user.points });
    return user;
  }

  /**
   * Get user's existing entry for this raffle using wallet_address (optimized)
   */
  private static async getUserEntry(walletAddress: string, raffleId: number | string): Promise<UserEntry | null> {
    const parsedRaffleId = typeof raffleId === 'string' ? parseInt(raffleId, 10) : raffleId;
    try {
      // Try wallet_address approach first (most efficient)
      let { data: entries, error } = await supabaseService
        .from('shellies_raffle_entries')
        .select('ticket_count, points_spent')
        .eq('wallet_address', walletAddress)
        .eq('raffle_id', parsedRaffleId);

      // If wallet_address column doesn't exist, fall back to user_id approach
      if (error && error.code === '42703') {
        // Only fetch user ID when needed for fallback
        const { data: user } = await supabaseService
          .from('shellies_raffle_users')
          .select('id')
          .eq('wallet_address', walletAddress)
          .single();

        if (user) {
          const { data: fallbackEntries, error: fallbackError } = await supabaseService
            .from('shellies_raffle_entries')
            .select('ticket_count, points_spent')
            .eq('user_id', user.id)
            .eq('raffle_id', parsedRaffleId);
          
          entries = fallbackEntries;
          error = fallbackError;
        }
      }

      // If no entries found, that's fine - return null
      if (error && error.code === 'PGRST116') {
        return null;
      }

      if (error) {
        console.error('Failed to fetch user entries:', error);
        return null; // Return null instead of throwing to avoid breaking flow
      }

      if (!entries || entries.length === 0) {
        return null;
      }

      // Sum all entries for this raffle and wallet
      const totalTicketCount = entries.reduce((sum, entry) => sum + entry.ticket_count, 0);
      const totalPointsSpent = entries.reduce((sum, entry) => sum + entry.points_spent, 0);

      return {
        ticket_count: totalTicketCount,
        points_spent: totalPointsSpent
      };
    } catch (error) {
      console.error('Error in getUserEntry:', error);
      return null;
    }
  }

  /**
   * Validate raffle status (not ended)
   */
  private static validateRaffleStatus(raffle: RaffleData) {
    const now = new Date();
    const endDate = new Date(raffle.end_date);

    if (endDate <= now) {
      const timeAgo = Math.ceil((now.getTime() - endDate.getTime()) / (1000 * 60 * 60)); // hours
      throw new ValidationError(
        `This raffle ended ${timeAgo} hour${timeAgo > 1 ? 's' : ''} ago`, 
        ERROR_CODES.RAFFLE_ENDED
      );
    }
  }

  /**
   * Validate user has enough points
   */
  private static validateUserEligibility(user: UserData, totalCost: number) {
    if (user.points < totalCost) {
      const shortage = totalCost - user.points;
      throw new ValidationError(
        `Insufficient points. You need ${totalCost} SHELL but have ${user.points} SHELL (${shortage} short)`,
        ERROR_CODES.INSUFFICIENT_POINTS
      );
    }
  }

  /**
   * Validate ticket limits
   */
  private static validateTicketLimits(
    ticketCount: number,
    newTotalTickets: number,
    maxTicketsPerUser: number,
    remainingTickets: number
  ) {
    if (remainingTickets <= 0) {
      throw new ValidationError(
        'You have already reached the maximum number of tickets for this raffle',
        ERROR_CODES.NO_REMAINING_TICKETS
      );
    }

    if (ticketCount > remainingTickets) {
      throw new ValidationError(
        `You can only purchase ${remainingTickets} more ticket${remainingTickets > 1 ? 's' : ''} for this raffle`,
        ERROR_CODES.MAX_TICKETS_EXCEEDED
      );
    }

    if (newTotalTickets > maxTicketsPerUser) {
      throw new ValidationError(
        `Maximum ${maxTicketsPerUser} tickets allowed per user. You currently have ${newTotalTickets - ticketCount} tickets.`,
        ERROR_CODES.MAX_TICKETS_EXCEEDED
      );
    }
  }

  /**
   * Get time remaining for a raffle in a human-readable format
   */
  static getTimeRemaining(endDate: string): string {
    const now = new Date();
    const end = new Date(endDate);
    const diffTime = end.getTime() - now.getTime();
    
    if (diffTime <= 0) return 'Ended';
    
    const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diffTime % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${days}d ${hours}h ${minutes}m`;
  }
}