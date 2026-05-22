import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { authOptions } from '@/lib/auth';
import { RaffleContractService } from '@/lib/raffle-contract';

const PUBLIC_RAFFLES_CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=120, s-maxage=300, stale-while-revalidate=600',
};

const PRIVATE_CACHE_HEADERS = {
  'Cache-Control': 'private, no-store',
};

type RaffleRow = {
  id: number;
  status?: string | null;
  [key: string]: any;
};

type EntrySummary = {
  participantCount: number;
  totalTickets: number;
  userTicketCount: number;
};

type EntrySummaryRpcRow = {
  raffle_id: number;
  participant_count: number | null;
  total_tickets: number | null;
  user_ticket_count: number | null;
};

type EntryRow = {
  raffle_id: number;
  wallet_address: string | null;
  ticket_count: number | null;
};

function hasSessionCookie(request: NextRequest): boolean {
  const cookieHeader = request.headers.get('cookie') || '';
  return (
    cookieHeader.includes('next-auth.session-token') ||
    cookieHeader.includes('__Secure-next-auth.session-token')
  );
}

function emptySummary(): EntrySummary {
  return {
    participantCount: 0,
    totalTickets: 0,
    userTicketCount: 0,
  };
}

// Module-scope cache: winners are immutable once resolved, so cache forever
// across warm Lambda invocations. Cold start drops the cache, which is fine.
const winnerCache = new Map<number, string>();
const TARGETED_LEGACY_WINNER_RAFFLE_ID = 156;
const OLD_RAFFLE_WINNER_CONTRACT_ADDRESSES = [
  '0x5B8Ab35F6894130253bE7199F9eA66F5Dc63D956',
  '0x47a27a42525ffF2b7264b342F74216E37A831332',
];
const OLD_RAFFLE_IDS = new Set([
  98, 99, 100, 101, 102, 103, 104, 105,
  106, 107, 108, 109, 110, 111, 112, 113,
  114, 115, 116, 117, 118, 119, 120, 121,
  127, 128, 129, 132, 136, 139, 145, 150, 154,
]);
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

function hasUsableWinnerAddress(walletAddress?: string | null): boolean {
  return Boolean(walletAddress && walletAddress.toLowerCase() !== ZERO_ADDRESS);
}

async function getOldRaffleWinner(raffleId: number): Promise<string | null> {
  for (const contractAddress of OLD_RAFFLE_WINNER_CONTRACT_ADDRESSES) {
    const raffleInfo = await RaffleContractService.getLegacyRafflePrizeInfo(
      raffleId.toString(),
      contractAddress
    );

    if (hasUsableWinnerAddress(raffleInfo?.winner)) {
      return raffleInfo!.winner;
    }
  }

  return null;
}

async function getWinnerInfo(raffles: RaffleRow[], includeWinners: boolean): Promise<Record<string, string>> {
  if (!includeWinners) return {};

  const finishedRaffles = raffles.filter((raffle) => raffle.status === 'COMPLETED');
  if (finishedRaffles.length === 0) return {};

  const result: Record<string, string> = {};
  const uncachedRaffles: RaffleRow[] = [];

  for (const raffle of finishedRaffles) {
    const cached = winnerCache.get(raffle.id);
    if (cached) {
      result[raffle.id] = cached;
    } else {
      uncachedRaffles.push(raffle);
    }
  }

  if (uncachedRaffles.length === 0) return result;

  const winnerResults = await Promise.all(
    uncachedRaffles.map(async (raffle) => {
      try {
        let winner: string | null = null;

        if (raffle.id === TARGETED_LEGACY_WINNER_RAFFLE_ID && raffle.contract_address) {
          const raffleInfo = await RaffleContractService.getRafflePrizeInfo(
            raffle.id.toString(),
            raffle.contract_address
          );
          winner = raffleInfo?.winner || null;
        } else if (OLD_RAFFLE_IDS.has(raffle.id)) {
          winner = await getOldRaffleWinner(raffle.id);
        } else {
          const raffleInfo = await RaffleContractService.getRafflePrizeInfo(raffle.id.toString());
          winner = raffleInfo?.winner || null;
        }

        if (hasUsableWinnerAddress(winner)) {
          return { raffleId: raffle.id, winner };
        }
      } catch (error) {
        console.error(`Error fetching winner for raffle ${raffle.id}:`, error);
      }

      return { raffleId: raffle.id, winner: null };
    })
  );

  for (const item of winnerResults) {
    if (item.winner) {
      result[item.raffleId] = item.winner;
      winnerCache.set(item.raffleId, item.winner);
    }
  }

  return result;
}

async function getEntrySummaries(
  raffleIds: number[],
  walletAddress: string | null
): Promise<Record<string, EntrySummary>> {
  const summaries = raffleIds.reduce((acc: Record<string, EntrySummary>, raffleId) => {
    acc[raffleId] = emptySummary();
    return acc;
  }, {});

  if (raffleIds.length === 0) return summaries;

  const client = supabaseAdmin || supabase;

  const { data: rpcRows, error: rpcError } = await client.rpc('get_raffle_entry_summaries', {
    p_raffle_ids: raffleIds,
    p_wallet_address: walletAddress,
  });

  if (!rpcError && rpcRows) {
    (rpcRows as EntrySummaryRpcRow[]).forEach((row) => {
      summaries[row.raffle_id] = {
        participantCount: row.participant_count || 0,
        totalTickets: row.total_tickets || 0,
        userTicketCount: row.user_ticket_count || 0,
      };
    });
    return summaries;
  }

  if (rpcError && rpcError.code !== '42883') {
    console.warn('Falling back to batched raffle entry query:', rpcError);
  }

  const { data: entries, error: entriesError } = await client
    .from('shellies_raffle_entries')
    .select('raffle_id, wallet_address, ticket_count')
    .in('raffle_id', raffleIds);

  if (entriesError) {
    console.error('Error fetching raffle entry summaries:', entriesError);
    return summaries;
  }

  const participantSets = new Map<number, Set<string>>();

  (entries as EntryRow[] | null)?.forEach((entry) => {
    const raffleId = Number(entry.raffle_id);
    const summary = summaries[raffleId] || emptySummary();
    const ticketCount = entry.ticket_count || 0;
    const entryWallet = entry.wallet_address?.toLowerCase() || '';

    summary.totalTickets += ticketCount;

    if (entryWallet) {
      if (!participantSets.has(raffleId)) {
        participantSets.set(raffleId, new Set());
      }
      participantSets.get(raffleId)?.add(entryWallet);
    }

    if (walletAddress && entryWallet === walletAddress) {
      summary.userTicketCount += ticketCount;
    }

    summaries[raffleId] = summary;
  });

  participantSets.forEach((wallets, raffleId) => {
    summaries[raffleId] = {
      ...(summaries[raffleId] || emptySummary()),
      participantCount: wallets.size,
    };
  });

  return summaries;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const includeWinners = searchParams.get('includeWinners') === 'true' || status === 'finished';

    // Only resolve NextAuth when there is a session cookie. Public landing-page
    // requests can then be browser/CDN cached and avoid personalized work.
    const session = hasSessionCookie(request) ? await getServerSession(authOptions) : null;
    const normalizedAddress = session?.address ? (session.address as string).toLowerCase() : null;
    const responseHeaders = normalizedAddress ? PRIVATE_CACHE_HEADERS : PUBLIC_RAFFLES_CACHE_HEADERS;

    const offset = (page - 1) * limit;

    let raffleQuery = supabase
      .from('shellies_raffle_raffles')
      .select('*', { count: 'exact' });

    // Always exclude blockchain failed raffles from portal display.
    raffleQuery = raffleQuery.or('status.neq.CANCELLED,and(status.eq.CANCELLED,blockchain_error.is.null)');

    // Always exclude hidden raffles from portal display
    raffleQuery = raffleQuery.or('is_hidden.is.null,is_hidden.eq.false');

    if (status === 'active') {
      raffleQuery = raffleQuery.eq('status', 'ACTIVE');
    } else if (status === 'finished') {
      raffleQuery = raffleQuery.in('status', ['COMPLETED', 'CANCELLED']);
    }

    if (status === 'all') {
      raffleQuery = raffleQuery
        .order('status', { ascending: true })
        .order('created_at', { ascending: false });
    } else {
      raffleQuery = raffleQuery.order('created_at', { ascending: false });
    }

    const { data: raffles, error: rafflesError, count: totalCount } = await raffleQuery
      .range(offset, offset + limit - 1);

    if (rafflesError) {
      console.error('Error fetching raffles:', rafflesError);
      return NextResponse.json({ error: 'Failed to fetch raffles' }, { status: 500 });
    }

    const raffleRows = (raffles || []) as RaffleRow[];
    const raffleIds = raffleRows.map((raffle) => raffle.id);

    const [winnerInfo, entrySummaries] = await Promise.all([
      getWinnerInfo(raffleRows, includeWinners),
      getEntrySummaries(raffleIds, normalizedAddress),
    ]);

    const rafflesWithCounts = raffleRows.map((raffle) => {
      const summary = entrySummaries[raffle.id] || emptySummary();

      return {
        ...raffle,
        user_ticket_count: summary.userTicketCount,
        current_participants: summary.participantCount,
        total_tickets_sold: summary.totalTickets,
        winner: winnerInfo[raffle.id] || null,
      };
    });

    return NextResponse.json({
      raffles: rafflesWithCounts,
      pagination: {
        page,
        limit,
        totalCount: totalCount || 0,
        hasMore: (totalCount || 0) > offset + rafflesWithCounts.length,
      },
    }, { headers: responseHeaders });
  } catch (error) {
    console.error('Error in raffles API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
