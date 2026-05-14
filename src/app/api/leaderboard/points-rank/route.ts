import { NextRequest, NextResponse } from 'next/server';
import { isHiddenLeaderboardWallet } from '@/lib/leaderboard-exclusions';

const EXPLORER_BASE_URL = 'https://explorer.inkonchain.com';
const MAX_SCAN_PAGES = 200;

type ExplorerPageParams = Record<string, string | number>;

function appendPageParams(url: URL, pageParams: ExplorerPageParams | null) {
  if (!pageParams) return;

  Object.entries(pageParams).forEach(([key, value]) => {
    url.searchParams.append(key, String(value));
  });
}

function getAddressHash(item: any): string | null {
  return item?.address?.hash ?? item?.address_hash ?? null;
}

function parsePoints(value: unknown): number {
  const points = Number.parseInt(String(value ?? '0'), 10);
  return Number.isFinite(points) ? points : 0;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress')?.trim();
    const contractAddress = process.env.NEXT_PUBLIC_SHELLIES_POINTS_CONTRACT_ADDRESS;

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
    }

    if (isHiddenLeaderboardWallet(walletAddress)) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!contractAddress || contractAddress === '0x') {
      return NextResponse.json({ error: 'Points contract address is not configured' }, { status: 500 });
    }

    let pageParams: ExplorerPageParams | null = null;
    let visibleOffset = 0;

    for (let page = 0; page < MAX_SCAN_PAGES; page += 1) {
      const url = new URL(`/api/v2/tokens/${contractAddress}/holders`, EXPLORER_BASE_URL);
      appendPageParams(url, pageParams);

      const response = await fetch(url.toString(), { cache: 'no-store' });

      if (!response.ok) {
        throw new Error(`Explorer holders request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const items = Array.isArray(data.items) ? data.items : [];
      const visibleItems = items.filter((item: any) => !isHiddenLeaderboardWallet(getAddressHash(item)));
      const userIndex = visibleItems.findIndex(
        (item: any) => getAddressHash(item)?.toLowerCase() === walletAddress.toLowerCase()
      );

      if (userIndex >= 0) {
        const item = visibleItems[userIndex];
        const matchedWallet = getAddressHash(item) || walletAddress;

        return NextResponse.json({
          rank: visibleOffset + userIndex + 1,
          wallet_address: matchedWallet,
          points: parsePoints(item.value),
          game_score: 0,
        });
      }

      const nextPageParams = data.next_page_params ?? null;
      if (!nextPageParams || items.length === 0) {
        break;
      }

      visibleOffset += visibleItems.length;
      pageParams = nextPageParams;
    }

    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  } catch (error) {
    console.error('Error fetching on-chain points rank:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
