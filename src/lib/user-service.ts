import { supabase, supabaseAdmin, User } from './supabase';

export class UserService {
  // Get or create user by wallet address
  static async getOrCreateUser(walletAddress: string): Promise<User | null> {
    try {
      // Use admin client to bypass RLS for server-side operations
      const client = supabaseAdmin || supabase;
      
      // First try to get existing user
      const { data: existingUser, error: fetchError } = await client
        .from('shellies_raffle_users')
        .select('*')
        .eq('wallet_address', walletAddress)
        .single();

      if (existingUser) {
        return existingUser;
      }

      // If user doesn't exist, create new one
      if (fetchError && fetchError.code === 'PGRST116') {
        const { data: newUser, error: createError } = await client
          .from('shellies_raffle_users')
          .insert([
            {
              wallet_address: walletAddress,
              points: 0,
              nft_count: 0,
            }
          ])
          .select()
          .single();

        if (createError) {
          console.error('Error creating user:', createError);
          return null;
        }

        return newUser;
      }

      console.error('Error fetching user:', fetchError);
      return null;
    } catch (error) {
      console.error('Unexpected error in getOrCreateUser:', error);
      return null;
    }
  }

  // Update user points
  static async updateUserPoints(walletAddress: string, points: number): Promise<boolean> {
    try {
      const client = supabaseAdmin || supabase;
      const { error } = await client
        .from('shellies_raffle_users')
        .update({ points, updated_at: new Date().toISOString() })
        .eq('wallet_address', walletAddress);

      if (error) {
        console.error('Error updating user points:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Unexpected error updating points:', error);
      return false;
    }
  }

  // Update NFT count
  static async updateUserNFTCount(walletAddress: string, nftCount: number): Promise<boolean> {
    try {
      const client = supabaseAdmin || supabase;
      const { error } = await client
        .from('shellies_raffle_users')
        .update({ nft_count: nftCount, updated_at: new Date().toISOString() })
        .eq('wallet_address', walletAddress);

      if (error) {
        console.error('Error updating NFT count:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Unexpected error updating NFT count:', error);
      return false;
    }
  }

  // Claim daily points
  static async claimDailyPoints(walletAddress: string, pointsToAdd: number): Promise<boolean> {
    try {
      // First get current user data
      const user = await this.getOrCreateUser(walletAddress);
      if (!user) return false;

      const now = new Date().toISOString();
      const newPoints = user.points + pointsToAdd;

      const client = supabaseAdmin || supabase;
      const { error } = await client
        .from('shellies_raffle_users')
        .update({
          points: newPoints,
          last_claim: now,
          updated_at: now
        })
        .eq('wallet_address', walletAddress);

      if (error) {
        console.error('Error claiming daily points:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Unexpected error claiming points:', error);
      return false;
    }
  }

  // Check if user can claim daily points (24 hours since last claim)
  static canClaimDaily(lastClaim: string | null): boolean {
    if (!lastClaim) return true;
    
    const lastClaimDate = new Date(lastClaim);
    const now = new Date();
    const hoursSinceLastClaim = (now.getTime() - lastClaimDate.getTime()) / (1000 * 60 * 60);
    
    return hoursSinceLastClaim >= 24;
  }

  // Get leaderboard
  static async getLeaderboard(limit: number = 10): Promise<User[]> {
    try {
      const client = supabaseAdmin || supabase;
      const { data, error } = await client
        .from('shellies_raffle_users')
        .select('*')
        .order('points', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching leaderboard:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Unexpected error fetching leaderboard:', error);
      return [];
    }
  }
}