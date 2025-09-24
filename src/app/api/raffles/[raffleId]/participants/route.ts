import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { authOptions } from '@/lib/auth';

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


    // Use admin client to bypass RLS since we've already authenticated the request
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Service configuration error' },
        { status: 500 }
      );
    }

    // Fetch all participants for this raffle with their transaction data
    // First try with join_tx_hash, fallback without it if column doesn't exist
    let participants, participantsError;
    
    try {
      const result = await supabaseAdmin
        .from('shellies_raffle_entries')
        .select(`
          wallet_address,
          ticket_count,
          points_spent,
          created_at,
          join_tx_hash
        `)
        .eq('raffle_id', raffleId)
        .order('created_at', { ascending: false });
      
      participants = result.data;
      participantsError = result.error;
      
    } catch (error: any) {
      // If join_tx_hash column doesn't exist, query without it
      if (error?.code === '42703' || (error?.message && error.message.includes('join_tx_hash'))) {
        const fallbackResult = await supabaseAdmin
          .from('shellies_raffle_entries')
          .select(`
            wallet_address,
            ticket_count,
            points_spent,
            created_at
          `)
          .eq('raffle_id', raffleId)
          .order('created_at', { ascending: false });
        
        participants = fallbackResult.data;
        participantsError = fallbackResult.error;
        
        // Add join_tx_hash as null for all entries
        if (participants) {
          participants = participants.map((entry: any) => ({
            ...entry,
            join_tx_hash: null
          }));
        }
      } else {
        participantsError = error;
      }
    }

    if (participantsError) {
      console.error('Error fetching raffle participants:', participantsError);
      return NextResponse.json(
        { error: 'Failed to fetch participants' },
        { status: 500 }
      );
    }

    // Group entries by wallet address and sum tickets
    const participantMap = new Map();
    
    participants?.forEach(entry => {
      const wallet = entry.wallet_address;
      if (participantMap.has(wallet)) {
        const existing = participantMap.get(wallet);
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