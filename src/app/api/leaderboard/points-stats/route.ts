import { NextResponse } from 'next/server';

const EXPLORER_BASE_URL = 'https://explorer.inkonchain.com';

const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=600',
};

const ERROR_CACHE_HEADERS = {
  'Cache-Control': 'no-store',
};

export async function GET() {
  try {
    const contractAddress = process.env.NEXT_PUBLIC_SHELLIES_POINTS_CONTRACT_ADDRESS;

    if (!contractAddress || contractAddress === '0x') {
      return NextResponse.json({ error: 'Points contract address is not configured' }, { status: 500 });
    }

    const url = new URL(`/api/v2/tokens/${contractAddress}/counters`, EXPLORER_BASE_URL);
    const response = await fetch(url.toString(), { cache: 'no-store' });

    if (!response.ok) {
      throw new Error(`Explorer counters request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const tokenHoldersCount = Number.parseInt(String(data.token_holders_count ?? '0'), 10);

    return NextResponse.json(
      {
        tokenHoldersCount: Number.isFinite(tokenHoldersCount) ? tokenHoldersCount : 0,
      },
      { headers: CACHE_HEADERS }
    );
  } catch (error) {
    console.error('Error fetching ShelliesPoints token stats:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch token stats',
        tokenHoldersCount: 0,
      },
      { status: 500, headers: ERROR_CACHE_HEADERS }
    );
  }
}
