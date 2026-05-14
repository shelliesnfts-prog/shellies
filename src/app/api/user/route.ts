import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { UserService } from '@/lib/user-service';
import { ShelliesPointsService } from '@/lib/shellies-points-service';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.address) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const walletAddress = session.address as string;
    const [user, onChainPoints] = await Promise.all([
      UserService.getOrCreateUser(walletAddress),
      ShelliesPointsService.getBalance(walletAddress),
    ]);

    if (!user) {
      return NextResponse.json({ error: 'Failed to get user data' }, { status: 500 });
    }

    return NextResponse.json({ ...user, points: onChainPoints });
  } catch (error) {
    console.error('Error in user API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // SECURITY FIX: This endpoint is deprecated and disabled
  // All claiming should go through /api/claim, /api/claim-staking, or /api/claim-unified
  // which properly calculate points server-side based on verified blockchain data
  return NextResponse.json({ 
    error: 'This endpoint is deprecated. Please use /api/claim-unified for claiming points.' 
  }, { status: 410 }); // 410 Gone - endpoint permanently disabled
}