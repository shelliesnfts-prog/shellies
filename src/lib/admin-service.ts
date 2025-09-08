import { supabase, supabaseAdmin, User, Raffle } from './supabase';

export class AdminService {
  // Check if a wallet address is an admin
  static async isAdmin(walletAddress: string): Promise<boolean> {
    try {
      const client = supabaseAdmin || supabase;
      const { data, error } = await client
        .from('shellies_raffle_admins')
        .select('id')
        .eq('wallet_address', walletAddress)
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking admin status:', error);
        return false;
      }

      return !!data;
    } catch (error) {
      console.error('Unexpected error checking admin:', error);
      return false;
    }
  }

  // Get all users with pagination
  static async getAllUsers(page: number = 1, limit: number = 20): Promise<{ users: User[], total: number }> {
    try {
      const client = supabaseAdmin || supabase;
      const offset = (page - 1) * limit;

      // Get total count
      const { count } = await client
        .from('shellies_raffle_users')
        .select('*', { count: 'exact', head: true });

      // Get paginated users
      const { data: users, error } = await client
        .from('shellies_raffle_users')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('Error fetching users:', error);
        return { users: [], total: 0 };
      }

      return { users: users || [], total: count || 0 };
    } catch (error) {
      console.error('Unexpected error fetching users:', error);
      return { users: [], total: 0 };
    }
  }

  // Block/Unblock user (soft delete by setting points to -1 or similar)
  static async toggleUserBlock(userId: string, blocked: boolean): Promise<boolean> {
    try {
      const client = supabaseAdmin || supabase;
      
      // Use a negative points value to indicate blocked status
      const updateData = blocked 
        ? { points: -999999 } // Blocked indicator
        : { points: Math.max(0, Math.abs(Math.floor(Math.random() * 100))) }; // Unblock with random points

      const { error } = await client
        .from('shellies_raffle_users')
        .update(updateData)
        .eq('id', userId);

      if (error) {
        console.error('Error toggling user block:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Unexpected error toggling user block:', error);
      return false;
    }
  }

  // Update user (points and status)
  static async updateUser(userId: string, updateData: { points?: number; status?: 'active' | 'blocked' }): Promise<boolean> {
    try {
      const client = supabaseAdmin || supabase;
      
      const updates: any = {};
      
      if (updateData.points !== undefined) {
        updates.points = updateData.points;
      }
      
      if (updateData.status !== undefined) {
        // Use points to indicate status - negative for blocked, positive/zero for active
        if (updateData.status === 'blocked') {
          updates.points = -999999; // Blocked indicator
        } else if (updateData.status === 'active' && updates.points === undefined) {
          // If setting to active but no specific points provided, use 0
          updates.points = Math.max(0, updates.points || 0);
        }
      }

      const { error } = await client
        .from('shellies_raffle_users')
        .update(updates)
        .eq('id', userId);

      if (error) {
        console.error('Error updating user:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Unexpected error updating user:', error);
      return false;
    }
  }

  // Delete user permanently
  static async deleteUser(userId: string): Promise<boolean> {
    try {
      const client = supabaseAdmin || supabase;
      
      const { error } = await client
        .from('shellies_raffle_users')
        .delete()
        .eq('id', userId);

      if (error) {
        console.error('Error deleting user:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Unexpected error deleting user:', error);
      return false;
    }
  }

  // Get all raffles
  static async getAllRaffles(): Promise<Raffle[]> {
    try {
      const client = supabaseAdmin || supabase;
      
      const { data: raffles, error } = await client
        .from('shellies_raffle_raffles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching raffles:', error);
        return [];
      }

      return raffles || [];
    } catch (error) {
      console.error('Unexpected error fetching raffles:', error);
      return [];
    }
  }

  // Create new raffle
  static async createRaffle(raffleData: {
    title: string;
    description: string;
    image_url?: string;
    points_per_ticket: number;
    max_tickets_per_user: number;
    max_participants?: number;
    end_date: string;
    prize_token_address?: string;
    prize_token_type?: 'NFT' | 'ERC20';
    prize_token_id?: string;
    prize_amount?: string;
  }): Promise<Raffle | null> {
    try {
      const client = supabaseAdmin || supabase;
      
      const { data: raffle, error } = await client
        .from('shellies_raffle_raffles')
        .insert([raffleData])
        .select()
        .single();

      if (error) {
        console.error('Error creating raffle:', error);
        return null;
      }

      return raffle;
    } catch (error) {
      console.error('Unexpected error creating raffle:', error);
      return null;
    }
  }

  // Update raffle
  static async updateRaffle(raffleId: string, raffleData: Partial<Raffle>): Promise<boolean> {
    try {
      const client = supabaseAdmin || supabase;
      
      const { error } = await client
        .from('shellies_raffle_raffles')
        .update(raffleData)
        .eq('id', raffleId);

      if (error) {
        console.error('Error updating raffle:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Unexpected error updating raffle:', error);
      return false;
    }
  }

  // End raffle by setting status to COMPLETED and calling smart contract (DEPRECATED - uses server wallet)
  static async endRaffleEarly(raffleId: string): Promise<{ success: boolean; txHash?: string; error?: string }> {
    console.warn('🚨 Using deprecated server wallet ending method. Consider using admin wallet ending instead.');
    
    try {
      const client = supabaseAdmin || supabase;
      
      // Step 1: Call smart contract to end raffle (picks winner and distributes prize)
      const { RaffleContractService } = await import('./raffle-contract');
      const contractResult = await RaffleContractService.serverEndRaffle(raffleId);
      
      if (!contractResult.success) {
        console.error('Smart contract end raffle failed:', contractResult.error);
        return { success: false, error: contractResult.error };
      }

      // Step 2: Update database status to COMPLETED (smart contract should have set this)
      const { error } = await client
        .from('shellies_raffle_raffles')
        .update({ 
          status: 'COMPLETED',
          end_date: new Date().toISOString()
        })
        .eq('id', raffleId);

      if (error) {
        console.error('Error updating raffle status:', error);
        return { success: false, error: 'Failed to update raffle status in database' };
      }

      console.log('Raffle ended successfully:', { raffleId, txHash: contractResult.txHash });
      return { success: true, txHash: contractResult.txHash };
    } catch (error) {
      console.error('Unexpected error ending raffle:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Get raffle participants for admin wallet ending
  static async getRaffleParticipants(raffleId: string): Promise<{
    success: boolean;
    participants?: string[];
    ticketCounts?: number[];
    totalParticipants?: number;
    totalTickets?: number;
    error?: string;
  }> {
    try {
      const client = supabaseAdmin || supabase;
      
      const { data: entries, error: entriesError } = await client
        .from('shellies_raffle_entries')
        .select('wallet_address, ticket_count')
        .eq('raffle_id', raffleId);

      if (entriesError) {
        console.error('Error fetching raffle entries:', entriesError);
        return { success: false, error: 'Failed to fetch raffle participants' };
      }

      if (!entries || entries.length === 0) {
        return { success: false, error: 'No participants found for this raffle' };
      }

      // Aggregate ticket counts by wallet address
      const participantMap = new Map<string, number>();
      entries.forEach((entry: any) => {
        const current = participantMap.get(entry.wallet_address) || 0;
        participantMap.set(entry.wallet_address, current + entry.ticket_count);
      });

      const participants = Array.from(participantMap.keys());
      const ticketCounts = Array.from(participantMap.values());
      const totalTickets = ticketCounts.reduce((sum, count) => sum + count, 0);

      return {
        success: true,
        participants,
        ticketCounts,
        totalParticipants: participants.length,
        totalTickets
      };
    } catch (error) {
      console.error('Unexpected error fetching participants:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Delete raffle permanently (for cleanup when blockchain fails)
  static async deleteRaffle(raffleId: string): Promise<boolean> {
    try {
      const client = supabaseAdmin || supabase;
      
      const { error } = await client
        .from('shellies_raffle_raffles')
        .delete()
        .eq('id', raffleId);

      if (error) {
        console.error('Error deleting raffle:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Unexpected error deleting raffle:', error);
      return false;
    }
  }

  // Get admin list
  static async getAdmins(): Promise<any[]> {
    try {
      const client = supabaseAdmin || supabase;
      
      const { data: admins, error } = await client
        .from('shellies_raffle_admins')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching admins:', error);
        return [];
      }

      return admins || [];
    } catch (error) {
      console.error('Unexpected error fetching admins:', error);
      return [];
    }
  }

  // Add new admin
  static async addAdmin(walletAddress: string, createdBy: string): Promise<boolean> {
    try {
      const client = supabaseAdmin || supabase;
      
      const { error } = await client
        .from('shellies_raffle_admins')
        .insert([{
          wallet_address: walletAddress,
          created_by: createdBy,
          is_active: true,
        }]);

      if (error) {
        console.error('Error adding admin:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Unexpected error adding admin:', error);
      return false;
    }
  }
}