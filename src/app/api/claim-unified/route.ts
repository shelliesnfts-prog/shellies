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

    // Step 1: Get NFT counts, staking stats, and period breakdown in parallel
    const [nftCount, stakingStats, stakingBreakdown] = await Promise.all([
      NFTService.getNFTCount(walletAddress),
      StakingService.getStakingStats(walletAddress),
      StakingService.getStakingPeriodBreakdown(walletAddress)
    ]);

    // Step 2: Calculate total points based on new formula:
    // available NFTs × 5 + daily staked NFTs × 7 + weekly staked NFTs × 10 + monthly staked NFTs × 20
    // For regular users (no NFTs): always 1 point
    const stakedNFTCount = stakingStats.totalStaked;
    const availableNFTCount = Math.max(0, nftCount - stakedNFTCount); // Available = Total - Staked
    let regularPoints = 0;
    let stakingPoints = 0;
    let totalPointsToAdd = 0;

    const totalOwnedNFTs = nftCount + stakedNFTCount; // Total NFTs = available + staked

    if (totalOwnedNFTs > 0) {
      // User has NFTs: calculate based on available + staked with new formula
      regularPoints = availableNFTCount * 5; // 5 points per available NFT
      stakingPoints = StakingService.calculateDailyPointsByPeriod(stakingBreakdown); // New period-based calculation
      totalPointsToAdd = regularPoints + stakingPoints;
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

    // Step 4: Return success with detailed breakdown
    return NextResponse.json({
      success: true,
      message: result.message,
      newPoints: result.new_points,
      pointsAdded: totalPointsToAdd,
      breakdown: {
        regularPoints,
        stakingPoints,
        nftCount,
        availableNFTCount,
        stakedNFTCount: stakingStats.totalStaked,
        stakingBreakdown
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