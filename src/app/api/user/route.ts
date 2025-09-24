import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { UserService } from '@/lib/user-service';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.address) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const user = await UserService.getOrCreateUser(session.address as string);
    
    if (!user) {
      return NextResponse.json({ error: 'Failed to get user data' }, { status: 500 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('Error in user API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.address) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { action, points, nftCount } = await request.json();

    const walletAddress = session.address as string;

    switch (action) {
      case 'claim_daily':
        const success = await UserService.claimDailyPoints(walletAddress, points || 1);
        if (!success) {
          return NextResponse.json({ error: 'Failed to claim daily points' }, { status: 500 });
        }
        break;


      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Return updated user data
    const updatedUser = await UserService.getOrCreateUser(walletAddress);
    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('Error in user POST API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}