import { NextRequest, NextResponse } from 'next/server';
import { UserService } from '@/lib/user-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');
    const type = searchParams.get('type') || 'points'; // 'points', 'gameXP', or 'both'

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
    }

    // Optimized: fetch both ranks in a single call when type is 'both'
    if (type === 'both') {
      const bothRanks = await UserService.getUserBothRanks(walletAddress);
      if (!bothRanks) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      return NextResponse.json(bothRanks);
    }

    let rankData;
    if (type === 'gameXP') {
      rankData = await UserService.getUserGameXPRank(walletAddress);
    } else {
      rankData = await UserService.getUserPointsRank(walletAddress);
    }

    if (!rankData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(rankData);
  } catch (error) {
    console.error('Error in user rank API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
