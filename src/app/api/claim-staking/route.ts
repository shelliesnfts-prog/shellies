import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { StakingService } from '@/lib/staking-service';
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
    console.log(`Processing staking claim for wallet: ${walletAddress}`);

    // Step 1: Check staked NFT count from blockchain
    const stakingStats = await StakingService.getStakingStats(walletAddress);
    const stakedNFTCount = stakingStats.totalStaked;
    
    console.log(`Staked NFT count for ${walletAddress}: ${stakedNFTCount}`);

    if (stakedNFTCount === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'No NFTs staked. Stake your NFTs first to earn staking rewards.' 
      }, { status: 400 });
    }

    // Step 2: Calculate staking points based on staked NFTs (10 points per NFT)
    const pointsToAdd = StakingService.calculateDailyPoints(stakedNFTCount);
    console.log(`Staking points to add: ${pointsToAdd}`);

    // Step 3: Use database function to safely process staking claim
    const client = supabaseAdmin || supabase;
    
    const { data, error } = await client
      .rpc('process_user_claim', {
        user_wallet: walletAddress,
        points_to_add: pointsToAdd
      });

    if (error) {
      console.error('Database error during staking claim:', error);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to process staking claim' 
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

    // Step 4: Return success with updated user data
    return NextResponse.json({ 
      success: true,
      message: result.message,
      newPoints: result.new_points,
      pointsAdded: pointsToAdd,
      stakedNFTCount: stakedNFTCount,
      nextClaimIn: 24 * 60 * 60 * 1000 // 24 hours in milliseconds
    });

  } catch (error) {
    console.error('Error in staking claim API:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// GET endpoint to check staking claim status without claiming
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.address) {
      return NextResponse.json({ 
        canClaim: false, 
        error: 'Not authenticated' 
      }, { status: 401 });
    }

    const walletAddress = session.address as string;
    const client = supabaseAdmin || supabase;

    // Get user's last claim info
    const { data: user, error: userError } = await client
      .from('shellies_raffle_users')
      .select('last_claim, points')
      .eq('wallet_address', walletAddress)
      .single();

    if (userError && userError.code !== 'PGRST116') {
      console.error('Error fetching user:', userError);
      return NextResponse.json({ 
        canClaim: false, 
        error: 'Failed to check staking claim status' 
      }, { status: 500 });
    }

    // Calculate time until next claim
    let canClaim = true;
    let secondsUntilNextClaim = 0;

    if (user?.last_claim) {
      const lastClaimTime = new Date(user.last_claim).getTime();
      const now = Date.now();
      const timeSinceLastClaim = now - lastClaimTime;
      const twentyFourHours = 24 * 60 * 60 * 1000;

      if (timeSinceLastClaim < twentyFourHours) {
        canClaim = false;
        secondsUntilNextClaim = Math.ceil((twentyFourHours - timeSinceLastClaim) / 1000);
      }
    }

    // Get staking stats for display
    const stakingStats = await StakingService.getStakingStats(walletAddress);
    const potentialPoints = StakingService.calculateDailyPoints(stakingStats.totalStaked);

    return NextResponse.json({
      canClaim: canClaim && stakingStats.totalStaked > 0, // Can only claim if has staked NFTs
      secondsUntilNextClaim,
      stakedNFTCount: stakingStats.totalStaked,
      potentialPoints,
      currentPoints: user?.points || 0,
      lastClaim: user?.last_claim || null
    });

  } catch (error) {
    console.error('Error in staking claim status API:', error);
    return NextResponse.json({ 
      canClaim: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}