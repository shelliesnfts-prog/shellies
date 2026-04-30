import { NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';

export const revalidate = 60;

export async function GET() {
  try {
    const db = supabaseAdmin || supabase;

    const [holdersRes, completedRes, totalRafflesRes, entriesRes] = await Promise.all([
      db.from('shellies_raffle_users').select('wallet_address', { count: 'exact', head: true }),
      db.from('shellies_raffle_raffles').select('id', { count: 'exact', head: true }).eq('status', 'COMPLETED'),
      db.from('shellies_raffle_raffles').select('id', { count: 'exact', head: true }),
      db.from('shellies_raffle_entries').select('ticket_count'),
    ]);

    const totalTicketsSold = (entriesRes.data || []).reduce(
      (sum: number, row: { ticket_count?: number }) => sum + (row.ticket_count || 0),
      0
    );

    return NextResponse.json({
      holders: holdersRes.count ?? 0,
      rafflesCompleted: completedRes.count ?? 0,
      rafflesTotal: totalRafflesRes.count ?? 0,
      ticketsSold: totalTicketsSold,
    });
  } catch (err) {
    console.error('landing/stats error', err);
    return NextResponse.json(
      { holders: 0, rafflesCompleted: 0, rafflesTotal: 0, ticketsSold: 0 },
      { status: 200 }
    );
  }
}
