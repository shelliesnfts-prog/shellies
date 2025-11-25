import { supabase, supabaseAdmin, User } from './supabase';

export class UserService {
  // Get or create user by wallet address (always fresh data)
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

  // Note: NFT count functionality removed - NFTs are now checked directly from blockchain

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

  // Get leaderboard with cursor-based pagination and optional wallet search
  // Optimized: Uses prefix search when possible for better index utilization
  static async getLeaderboard(
    limit: number = 10,
    userWallet?: string,
    cursor?: number,
    searchWallet?: string
  ): Promise<(User & { originalRank?: number })[]> {
    try {
      const client = supabaseAdmin || supabase;

      // Build query - select wallet_address, points, and game_score
      let query = client
        .from('shellies_raffle_users')
        .select('wallet_address, points, game_score')
        .order('points', { ascending: false })
        .order('wallet_address', { ascending: true }) // Secondary sort for consistency
        .limit(limit);

      // Apply wallet search filter if provided
      // Optimization: Use prefix match (ilike 'term%') when search starts with '0x' for better index usage
      // Fall back to contains match for partial searches
      if (searchWallet && searchWallet.trim()) {
        const trimmedSearch = searchWallet.trim().toLowerCase();
        if (trimmedSearch.startsWith('0x') && trimmedSearch.length >= 4) {
          // Prefix search - can use index
          query = query.ilike('wallet_address', `${trimmedSearch}%`);
        } else {
          // Contains search - full scan but necessary for partial matches
          query = query.ilike('wallet_address', `%${trimmedSearch}%`);
        }
      }

      // Apply cursor if provided (get users with points less than cursor)
      if (cursor !== undefined) {
        query = query.lt('points', cursor);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching leaderboard:', error);
        return [];
      }

      let result: any[] = data || [];

      // If userWallet is provided, mark the current user
      if (userWallet && result.length > 0) {
        const userIndex = result.findIndex(
          user => user.wallet_address.toLowerCase() === userWallet.toLowerCase()
        );

        if (userIndex >= 0) {
          result[userIndex] = {
            ...result[userIndex],
            originalRank: userIndex + 1
          };
        }
      }

      return result;
    } catch (error) {
      console.error('Unexpected error fetching leaderboard:', error);
      return [];
    }
  }

  // Get game XP leaderboard with cursor-based pagination and optional wallet search
  // Optimized: Uses prefix search when possible for better index utilization
  static async getGameXPLeaderboard(
    limit: number = 50,
    userWallet?: string,
    cursor?: number,
    searchWallet?: string
  ): Promise<(User & { originalRank?: number })[]> {
    try {
      const client = supabaseAdmin || supabase;

      // Build query - select wallet_address, points, and game_score
      let query = client
        .from('shellies_raffle_users')
        .select('wallet_address, points, game_score')
        .gt('game_score', 0) // Only include users with game score
        .order('game_score', { ascending: false })
        .order('wallet_address', { ascending: true }) // Secondary sort for consistency
        .limit(limit);

      // Apply wallet search filter if provided
      // Optimization: Use prefix match when search starts with '0x' for better index usage
      if (searchWallet && searchWallet.trim()) {
        const trimmedSearch = searchWallet.trim().toLowerCase();
        if (trimmedSearch.startsWith('0x') && trimmedSearch.length >= 4) {
          query = query.ilike('wallet_address', `${trimmedSearch}%`);
        } else {
          query = query.ilike('wallet_address', `%${trimmedSearch}%`);
        }
      }

      // Apply cursor if provided (get users with game_score less than cursor)
      if (cursor !== undefined) {
        query = query.lt('game_score', cursor);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching game XP leaderboard:', error);
        return [];
      }

      let result: any[] = data || [];

      // If userWallet is provided, mark the current user
      if (userWallet && result.length > 0) {
        const userIndex = result.findIndex(
          user => user.wallet_address.toLowerCase() === userWallet.toLowerCase()
        );

        if (userIndex >= 0) {
          result[userIndex] = {
            ...result[userIndex],
            originalRank: userIndex + 1
          };
        }
      }

      return result;
    } catch (error) {
      console.error('Unexpected error fetching game XP leaderboard:', error);
      return [];
    }
  }

  // Get user's rank and data for points leaderboard
  // Optimized: Fetches user data first, then counts in parallel if needed
  static async getUserPointsRank(walletAddress: string): Promise<{
    rank: number;
    wallet_address: string;
    points: number;
    game_score: number;
  } | null> {
    try {
      const client = supabaseAdmin || supabase;

      // Get the user's data first
      const { data: userData, error: userError } = await client
        .from('shellies_raffle_users')
        .select('wallet_address, points, game_score')
        .eq('wallet_address', walletAddress)
        .single();

      if (userError || !userData) {
        return null;
      }

      // Count users with more points to determine rank
      // Using head: true for count-only query (no data transfer)
      const { count, error: countError } = await client
        .from('shellies_raffle_users')
        .select('*', { count: 'exact', head: true })
        .gt('points', userData.points);

      if (countError) {
        console.error('Error counting users for rank:', countError);
        return null;
      }

      return {
        rank: (count || 0) + 1,
        wallet_address: userData.wallet_address,
        points: userData.points,
        game_score: userData.game_score || 0
      };
    } catch (error) {
      console.error('Unexpected error getting user points rank:', error);
      return null;
    }
  }

  // Get user's rank and data for game XP leaderboard
  // Optimized: Fetches user data first, then counts in parallel if needed
  static async getUserGameXPRank(walletAddress: string): Promise<{
    rank: number;
    wallet_address: string;
    points: number;
    game_score: number;
  } | null> {
    try {
      const client = supabaseAdmin || supabase;

      // Get the user's data first
      const { data: userData, error: userError } = await client
        .from('shellies_raffle_users')
        .select('wallet_address, points, game_score')
        .eq('wallet_address', walletAddress)
        .single();

      if (userError || !userData) {
        return null;
      }

      // If user has no game score, they're not ranked - skip count query
      if (!userData.game_score || userData.game_score <= 0) {
        return {
          rank: 0, // 0 indicates unranked
          wallet_address: userData.wallet_address,
          points: userData.points,
          game_score: 0
        };
      }

      // Count users with more game_score to determine rank
      const { count, error: countError } = await client
        .from('shellies_raffle_users')
        .select('*', { count: 'exact', head: true })
        .gt('game_score', userData.game_score);

      if (countError) {
        console.error('Error counting users for game XP rank:', countError);
        return null;
      }

      return {
        rank: (count || 0) + 1,
        wallet_address: userData.wallet_address,
        points: userData.points,
        game_score: userData.game_score
      };
    } catch (error) {
      console.error('Unexpected error getting user game XP rank:', error);
      return null;
    }
  }

  // Get both ranks in a single call - optimized for fetching both at once
  static async getUserBothRanks(walletAddress: string): Promise<{
    pointsRank: { rank: number; points: number } | null;
    gameXPRank: { rank: number; game_score: number } | null;
    wallet_address: string;
  } | null> {
    try {
      const client = supabaseAdmin || supabase;

      // Get the user's data first
      const { data: userData, error: userError } = await client
        .from('shellies_raffle_users')
        .select('wallet_address, points, game_score')
        .eq('wallet_address', walletAddress)
        .single();

      if (userError || !userData) {
        return null;
      }

      // Run both count queries in parallel
      const [pointsCountResult, gameXPCountResult] = await Promise.all([
        client
          .from('shellies_raffle_users')
          .select('*', { count: 'exact', head: true })
          .gt('points', userData.points),
        userData.game_score && userData.game_score > 0
          ? client
              .from('shellies_raffle_users')
              .select('*', { count: 'exact', head: true })
              .gt('game_score', userData.game_score)
          : Promise.resolve({ count: null, error: null })
      ]);

      return {
        wallet_address: userData.wallet_address,
        pointsRank: {
          rank: (pointsCountResult.count || 0) + 1,
          points: userData.points
        },
        gameXPRank: userData.game_score && userData.game_score > 0
          ? {
              rank: (gameXPCountResult.count || 0) + 1,
              game_score: userData.game_score
            }
          : {
              rank: 0,
              game_score: 0
            }
      };
    } catch (error) {
      console.error('Unexpected error getting user both ranks:', error);
      return null;
    }
  }

  // Get game statistics
  static async getGameStats(): Promise<{
    totalPlayers: number;
    averageXP: number;
    topScore: number;
  }> {
    try {
      const client = supabaseAdmin || supabase;

      // Get aggregated statistics
      const { data, error } = await client
        .from('shellies_raffle_users')
        .select('game_score')
        .gt('game_score', 0);

      if (error) {
        console.error('Error fetching game stats:', error);
        return { totalPlayers: 0, averageXP: 0, topScore: 0 };
      }

      if (!data || data.length === 0) {
        return { totalPlayers: 0, averageXP: 0, topScore: 0 };
      }

      const totalPlayers = data.length;
      const totalXP = data.reduce((sum, user) => sum + (user.game_score || 0), 0);
      const averageXP = totalXP / totalPlayers;

      // Get the top score by querying the first entry ordered by game_score descending
      const { data: topScoreData, error: topScoreError } = await client
        .from('shellies_raffle_users')
        .select('game_score')
        .gt('game_score', 0)
        .order('game_score', { ascending: false })
        .limit(1)
        .single();

      const topScore = topScoreError || !topScoreData ? 0 : topScoreData.game_score;

      return {
        totalPlayers,
        averageXP: Math.round(averageXP),
        topScore
      };
    } catch (error) {
      console.error('Unexpected error fetching game stats:', error);
      return { totalPlayers: 0, averageXP: 0, topScore: 0 };
    }
  }

}