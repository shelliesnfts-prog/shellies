import { NextRequest, NextResponse } from 'next/server';
import { UserService } from '@/lib/user-service';

const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=600',
};

export async function GET(request: NextRequest) {
  try {
    const stats = await UserService.getGameStats();
    
    return NextResponse.json(stats, { headers: CACHE_HEADERS });
  } catch (error) {
    console.error('Error in game stats API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
