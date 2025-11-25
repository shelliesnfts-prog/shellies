import { NextRequest, NextResponse } from 'next/server';
import { UserService } from '@/lib/user-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const userWallet = searchParams.get('userWallet') || undefined;
    const cursor = searchParams.get('cursor') ? parseFloat(searchParams.get('cursor')!) : undefined;
    const searchWallet = searchParams.get('searchWallet') || undefined;
    
    const leaderboard = await UserService.getGameXPLeaderboard(limit, userWallet, cursor, searchWallet);
    
    return NextResponse.json(leaderboard);
  } catch (error) {
    console.error('Error in game XP leaderboard API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
