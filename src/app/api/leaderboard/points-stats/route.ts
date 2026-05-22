import { NextResponse } from 'next/server';

const EXPLORER_BASE_URL = 'https://explorer.inkonchain.com';
const HOLDERS_FRESH_MS = 5 * 60 * 1000;
const EXPLORER_TIMEOUT_MS = 5000;

const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=600',
};

type HoldersCache = {
  contractAddress: string;
  updatedAt: number;
  value: number;
};

let holdersCache: HoldersCache | null = null;

function normalizeAddress(address: string): string {
  return address.toLowerCase();
}

function isFreshCache(contractAddress: string): boolean {
  return (
    holdersCache?.contractAddress === normalizeAddress(contractAddress) &&
    Date.now() - holdersCache.updatedAt < HOLDERS_FRESH_MS
  );
}

async function fetchTokenHoldersCount(contractAddress: string): Promise<number> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), EXPLORER_TIMEOUT_MS);

  try {
    const url = new URL(`/api/v2/tokens/${contractAddress}/counters`, EXPLORER_BASE_URL);
    const response = await fetch(url.toString(), {
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Explorer counters request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const tokenHoldersCount = Number.parseInt(String(data.token_holders_count ?? '0'), 10);

    return Number.isFinite(tokenHoldersCount) ? tokenHoldersCount : 0;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function GET() {
  const contractAddress = process.env.NEXT_PUBLIC_SHELLIES_POINTS_CONTRACT_ADDRESS;

  if (!contractAddress || contractAddress === '0x') {
    return NextResponse.json({ error: 'Points contract address is not configured' }, { status: 500 });
  }

  const freshCache = holdersCache;

  if (isFreshCache(contractAddress) && freshCache) {
    return NextResponse.json(
      {
        tokenHoldersCount: freshCache.value,
      },
      { headers: CACHE_HEADERS }
    );
  }

  try {
    const tokenHoldersCount = await fetchTokenHoldersCount(contractAddress);
    holdersCache = {
      contractAddress: normalizeAddress(contractAddress),
      updatedAt: Date.now(),
      value: tokenHoldersCount,
    };

    return NextResponse.json(
      {
        tokenHoldersCount,
      },
      { headers: CACHE_HEADERS }
    );
  } catch (error) {
    console.warn('Unable to refresh ShelliesPoints holders count:', error);

    return NextResponse.json(
      {
        tokenHoldersCount:
          holdersCache?.contractAddress === normalizeAddress(contractAddress)
            ? holdersCache.value
            : 0,
      },
      { headers: CACHE_HEADERS }
    );
  }
}
