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

    // Fetch user data, NFT count, staking stats, and period breakdown in parallel
    const [user, nftCount, stakingStats, stakingBreakdown] = await Promise.all([
      UserService.getOrCreateUser(walletAddress, true), // bypass cache for fresh data
      NFTService.getNFTCount(walletAddress),
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

    // Calculate points based on new formula:
    // available NFTs × 5 + daily staked NFTs × 7 + weekly staked NFTs × 10 + monthly staked NFTs × 20
    // For regular users (no NFTs): always 1 point
    const stakedNFTCount = stakingStats.totalStaked;
    const availableNFTCount = Math.max(0, nftCount - stakedNFTCount); // Available = Total - Staked
    let regularPoints = 0;
    let stakingPoints = 0;
    let totalPotentialPoints = 0;

    if (nftCount > 0) {
      // User has NFTs: calculate based on available + staked with new formula
      regularPoints = availableNFTCount * 5; // 5 points per available NFT
      stakingPoints = StakingService.calculateDailyPointsByPeriod(stakingBreakdown); // New period-based calculation
      totalPotentialPoints = regularPoints + stakingPoints;
    } else {
      // Regular user with no NFTs: get base point
      regularPoints = 1;
      totalPotentialPoints = regularPoints;
    }

    // Return combined data
    return NextResponse.json({
      user,
      claimStatus: {
        canClaim,
        secondsUntilNextClaim,
        nftCount: availableNFTCount, // Return available NFTs (total - staked) for profile display
        totalNFTCount: nftCount, // Total owned NFTs for reference
        stakedNFTCount,
        regularPoints,
        stakingPoints,
        potentialPoints: totalPotentialPoints, // Combined total
        currentPoints: user.points,
        lastClaim: user.last_claim
      }
    });

  } catch (error) {
    console.error('Error in dashboard API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}