import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { UserService } from '@/lib/user-service';
import { NFTService } from '@/lib/nft-service';
import { StakingService } from '@/lib/staking-service';
import { createClient } from '@supabase/supabase-js';

// Service client for database operations
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

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.address) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const walletAddress = session.address as string;

    // Staking service no longer uses caching - always fetches fresh data

    // Fetch user data, staking stats, and period breakdown in parallel
    // NFT count is now handled client-side for real-time data
    const [user, stakingStats, stakingBreakdown] = await Promise.all([
      UserService.getOrCreateUser(walletAddress),
      StakingService.getStakingStats(walletAddress),
      StakingService.getStakingPeriodBreakdown(walletAddress)
    ]);
    
    if (!user) {
      return NextResponse.json({ error: 'Failed to get user data' }, { status: 500 });
    }

    // Calculate claim status
    let canClaim = true;
    let secondsUntilNextClaim = 0;

    if (user.last_claim) {
      const lastClaimTime = new Date(user.last_claim).getTime();
      const now = Date.now();
      const timeSinceLastClaim = now - lastClaimTime;
      const twentyFourHours = 24 * 60 * 60 * 1000;

      if (timeSinceLastClaim < twentyFourHours) {
        canClaim = false;
        secondsUntilNextClaim = Math.ceil((twentyFourHours - timeSinceLastClaim) / 1000);
      }
    }

    // Calculate staking points only (NFT-based points calculated client-side)
    const stakedNFTCount = stakingStats.totalStaked;
    const stakingPoints = StakingService.calculateDailyPointsByPeriod(stakingBreakdown);

    // Return combined data (NFT count handled client-side)
    return NextResponse.json({
      user,
      claimStatus: {
        canClaim,
        secondsUntilNextClaim,
        stakedNFTCount,
        stakingPoints,
        currentPoints: user.points,
        lastClaim: user.last_claim
      }
    });

  } catch (error) {
    console.error('Error in dashboard API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}