import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { StakingService } from '@/lib/staking-service';
import { UserService } from '@/lib/user-service';
import { NFTService } from '@/lib/nft-service';
import { supabaseAdmin, supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.address) {
      return NextResponse.json({
        success: false,
        error: 'Not authenticated'
      }, { status: 401 });
    }

    const walletAddress = session.address as string;

    // Step 1: Get NFT counts and staking info in parallel
    const [nftCount, stakingStats] = await Promise.all([
      NFTService.getNFTCount(walletAddress),
      StakingService.getStakingStats(walletAddress)
    ]);

    // Step 2: Calculate total points based on user type
    let regularPoints = 0;
    let stakingPoints = 0;
    let totalPointsToAdd = 0;

    if (stakingStats.totalStaked > 0) {
      // User has staked NFTs: only get staking points (10 per staked NFT)
      stakingPoints = StakingService.calculateDailyPoints(stakingStats.totalStaked);
      totalPointsToAdd = stakingPoints;
    } else if (nftCount > 0) {
      // User has NFTs but no staking: get holder points (5 per NFT)
      regularPoints = NFTService.calculateClaimPoints(nftCount);
      totalPointsToAdd = regularPoints;
    } else {
      // Regular user with no NFTs: get base point
      regularPoints = 1;
      totalPointsToAdd = regularPoints;
    }

    if (totalPointsToAdd === 0) {
      return NextResponse.json({
        success: false,
        error: 'No points available to claim. Get some NFTs or stake existing ones!'
      }, { status: 400 });
    }

    // Step 3: Use database function to safely process unified claim
    const client = supabaseAdmin || supabase;

    const { data, error } = await client
      .rpc('process_user_claim', {
        user_wallet: walletAddress,
        points_to_add: totalPointsToAdd
      });

    if (error) {
      console.error('Database error during unified claim:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to process claim'
      }, { status: 500 });
    }

    // The function returns a single row with success, new_points, message
    const result = data[0];

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.message,
        canClaimAgainIn: null // Frontend should calculate this
      }, { status: 400 });
    }

    // Step 4: Clear all relevant caches to ensure fresh data on next fetch
    UserService.clearUserCache(walletAddress);
    NFTService.clearCache(walletAddress);
    StakingService.clearCache(walletAddress);

    // Step 5: Return success with detailed breakdown
    return NextResponse.json({
      success: true,
      message: result.message,
      newPoints: result.new_points,
      pointsAdded: totalPointsToAdd,
      breakdown: {
        regularPoints,
        stakingPoints,
        nftCount,
        stakedNFTCount: stakingStats.totalStaked
      },
      nextClaimIn: 24 * 60 * 60 * 1000 // 24 hours in milliseconds
    });

  } catch (error) {
    console.error('Error in unified claim API:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}