import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NFTService } from '@/lib/nft-service';
import { UserService } from '@/lib/user-service';
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
    console.log(`Processing claim for wallet: ${walletAddress}`);

    // Step 1: Check NFT count from blockchain
    const nftCount = await NFTService.getNFTCount(walletAddress);
    console.log(`NFT count for ${walletAddress}: ${nftCount}`);

    // Step 2: Calculate points based on NFT ownership
    const pointsToAdd = NFTService.calculateClaimPoints(nftCount);
    console.log(`Points to add: ${pointsToAdd}`);

    // Step 3: Use database function to safely process claim
    const client = supabaseAdmin || supabase;
    
    const { data, error } = await client
      .rpc('process_user_claim', {
        user_wallet: walletAddress,
        points_to_add: pointsToAdd
      });

    if (error) {
      console.error('Database error during claim:', error);
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

    // Step 5: Return success with updated user data
    return NextResponse.json({ 
      success: true,
      message: result.message,
      newPoints: result.new_points,
      pointsAdded: pointsToAdd,
      nftCount: nftCount,
      nextClaimIn: 24 * 60 * 60 * 1000 // 24 hours in milliseconds
    });

  } catch (error) {
    console.error('Error in claim API:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// GET endpoint to check claim status without claiming
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

    // Get user's last claim info - always fetch fresh data to avoid stale cache
    const { data: user, error: userError } = await client
      .from('shellies_raffle_users')
      .select('last_claim, points')
      .eq('wallet_address', walletAddress)
      .single();

    if (userError && userError.code !== 'PGRST116') {
      console.error('Error fetching user:', userError);
      return NextResponse.json({ 
        canClaim: false, 
        error: 'Failed to check claim status' 
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

    // Get NFT count for display
    const nftCount = await NFTService.getNFTCount(walletAddress);
    const potentialPoints = NFTService.calculateClaimPoints(nftCount);

    return NextResponse.json({
      canClaim,
      secondsUntilNextClaim,
      nftCount,
      potentialPoints,
      currentPoints: user?.points || 0,
      lastClaim: user?.last_claim || null
    });

  } catch (error) {
    console.error('Error in claim status API:', error);
    return NextResponse.json({ 
      canClaim: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}