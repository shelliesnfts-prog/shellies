import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { UserService } from '@/lib/user-service';
import { NFTService } from '@/lib/nft-service';
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
    
    // Fetch user data and NFT count in parallel (bypass cache to get fresh last_claim data)
    const [user, nftCount] = await Promise.all([
      UserService.getOrCreateUser(walletAddress, true), // bypass cache for fresh data
      NFTService.getNFTCount(walletAddress)
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

    const potentialPoints = NFTService.calculateClaimPoints(nftCount);

    // Return combined data
    return NextResponse.json({
      user,
      claimStatus: {
        canClaim,
        secondsUntilNextClaim,
        nftCount,
        potentialPoints,
        currentPoints: user.points,
        lastClaim: user.last_claim
      }
    });

  } catch (error) {
    console.error('Error in dashboard API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}