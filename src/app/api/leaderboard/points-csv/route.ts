import { NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { HIDDEN_LEADERBOARD_WALLETS } from '@/lib/leaderboard-exclusions';

const TABLE_NAME = 'shellies_raffle_users';
const BATCH_SIZE = 1000;
const CSV_FILENAME = 'points-leaderboard.csv';

interface RawPointsRow {
  wallet_address: string;
  points: number | string | null;
}

interface PointsRow {
  wallet_address: string;
  points: number;
}

function parsePoints(value: number | string | null): number {
  const points = Number(value ?? 0);
  return Number.isFinite(points) ? points : 0;
}

function escapeCsvValue(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function buildCsv(rows: PointsRow[]): string {
  const csvRows = rows.map((row) => (
    `${escapeCsvValue(row.wallet_address)},${escapeCsvValue(row.points)}`
  ));

  return ['wallet_address,points', ...csvRows].join('\n') + '\n';
}

async function fetchAllPointsRows(): Promise<PointsRow[]> {
  const client = supabaseAdmin || supabase;
  const rows: PointsRow[] = [];
  let from = 0;

  while (true) {
    const to = from + BATCH_SIZE - 1;
    const { data, error } = await client
      .from(TABLE_NAME)
      .select('wallet_address, points')
      .not('wallet_address', 'ilike', HIDDEN_LEADERBOARD_WALLETS[0])
      .order('points', { ascending: false })
      .order('wallet_address', { ascending: true })
      .range(from, to);

    if (error) {
      throw error;
    }

    const page = (data ?? []) as RawPointsRow[];
    rows.push(
      ...page.map((row) => ({
        wallet_address: row.wallet_address,
        points: parsePoints(row.points),
      }))
    );

    if (page.length < BATCH_SIZE) {
      break;
    }

    from += BATCH_SIZE;
  }

  return rows;
}

export async function GET() {
  try {
    const rows = await fetchAllPointsRows();

    return new NextResponse(buildCsv(rows), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${CSV_FILENAME}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Error generating points CSV:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate points CSV',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
