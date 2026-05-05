import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { authOptions } from '@/lib/auth';

type ParticipantRow = {
  wallet_address: string;
  ticket_count: number;
  points_spent: number;
  created_at: string;
  join_tx_hash?: string | null;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ raffleId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.address) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const resolvedParams = await params;
    const raffleIdStr = resolvedParams.raffleId;
    
    // Convert raffle ID to integer since database uses integer IDs
    const raffleId = parseInt(raffleIdStr, 10);
    if (isNaN(raffleId)) {
      return NextResponse.json(
        { error: 'Invalid raffle ID' },
        { status: 400 }
      );
    }


    const client = supabaseAdmin || supabase;

    const { data: rpcParticipants, error: rpcError } = await client.rpc('get_raffle_participants_summary', {
      p_raffle_id: raffleId,
    });

    if (!rpcError && rpcParticipants) {
      return NextResponse.json({
        success: true,
        data: rpcParticipants,
        total: rpcParticipants.length
      });
    }

    if (rpcError && rpcError.code !== '42883') {
      console.warn('Falling back to raw participant query:', rpcError);
    }

    // Fallback for environments where the aggregate RPC migration has not been applied.
    const { data: participants, error: participantsError } = await client
      .from('shellies_raffle_entries')
      .select(`
        wallet_address,
        ticket_count,
        points_spent,
        created_at,
        join_tx_hash
      `)
      .eq('raffle_id', raffleId)
      .order('created_at', { ascending: true });

    if (participantsError) {
      console.error('Error fetching raffle participants:', participantsError);
      return NextResponse.json(
        { error: 'Failed to fetch participants' },
        { status: 500 }
      );
    }

    // Group entries by wallet address and sum tickets
    const participantMap = new Map<string, ParticipantRow>();
    
    participants?.forEach(entry => {
      const wallet = entry.wallet_address;
      if (participantMap.has(wallet)) {
        const existing = participantMap.get(wallet)!;
        existing.ticket_count += entry.ticket_count;
        existing.points_spent += entry.points_spent;
        // Keep the earliest join date for this wallet
        if (entry.created_at < existing.created_at) {
          existing.created_at = entry.created_at;
          existing.join_tx_hash = entry.join_tx_hash;
        }
      } else {
        participantMap.set(wallet, {
          wallet_address: wallet,
          ticket_count: entry.ticket_count,
          points_spent: entry.points_spent,
          created_at: entry.created_at,
          join_tx_hash: entry.join_tx_hash || null
        });
      }
    });

    // Convert map to array and sort by join date
    const uniqueParticipants = Array.from(participantMap.values())
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    return NextResponse.json({
      success: true,
      data: uniqueParticipants,
      total: uniqueParticipants.length
    });

  } catch (error) {
    console.error('Participants API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
