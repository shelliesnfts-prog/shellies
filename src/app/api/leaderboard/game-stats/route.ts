import { NextRequest, NextResponse } from 'next/server';
import { UserService } from '@/lib/user-service';

export async function GET(request: NextRequest) {
  try {
    const stats = await UserService.getGameStats();
    
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error in game stats API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
