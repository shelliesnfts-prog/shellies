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
    
    // Fetch user data, NFT count, and staking stats in parallel (bypass cache to get fresh last_claim data)
    const [user, nftCount, stakingStats] = await Promise.all([
      UserService.getOrCreateUser(walletAddress, true), // bypass cache for fresh data
      NFTService.getNFTCount(walletAddress),
      StakingService.getStakingStats(walletAddress)
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

    // Calculate points based on user type (no stacking of base points)
    const stakedNFTCount = stakingStats.totalStaked;
    const availableNFTCount = Math.max(0, nftCount - stakedNFTCount); // Available = Total - Staked
    let regularPoints = 0;
    let stakingPoints = 0;
    let totalPotentialPoints = 0;

    if (stakedNFTCount > 0) {
      // User has staked NFTs: only get staking points (10 per staked NFT)
      stakingPoints = StakingService.calculateDailyPoints(stakedNFTCount);
      totalPotentialPoints = stakingPoints;
    } else if (nftCount > 0) {
      // User has NFTs but no staking: get holder points (5 per NFT)
      regularPoints = NFTService.calculateClaimPoints(nftCount);
      totalPotentialPoints = regularPoints;
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