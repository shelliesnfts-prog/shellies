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
    const client = supabaseAdmin || supabase;
    if (!client) {
      return NextResponse.json(
        { error: 'Service configuration error' },
        { status: 500 }
      );
    }

    // First, use RPC function to get participants (more reliable, bypasses RLS)
    let participants: any[] = [];
    let participantsError;
    
    try {
      // Try RPC with increased limit
      const { data: rpcData, error: rpcError, count } = await client
        .rpc('get_raffle_participants', { p_raffle_id: raffleId });
      
      console.log(`[Participants] RPC count: ${count}, data length: ${rpcData?.length}`);
      
      if (!rpcError && rpcData && Array.isArray(rpcData)) {
        participants = rpcData;
        console.log(`[Participants] RPC fetched ${participants.length} entries for raffle ${raffleId}`);
        
        // If we got exactly 1000, there might be more - try to fetch more
        if (participants.length >= 1000) {
          console.log(`[Participants] Got 1000+ entries, fetching more via direct query...`);
          // Continue with direct query to get remaining entries
          const pageSize = 1000;
          let offset = 1000;
          let hasMore = true;
          
          while (hasMore) {
            try {
              const moreResult = await client
                .from('shellies_raffle_entries')
                .select(`
                  wallet_address,
                  ticket_count,
                  points_spent,
                  created_at,
                  join_tx_hash
                `)
                .eq('raffle_id', raffleId)
                .order('created_at', { ascending: false })
                .range(offset, offset + pageSize - 1);
              
              if (moreResult.data && moreResult.data.length > 0) {
                participants = [...participants, ...moreResult.data];
                console.log(`[Participants] Fetched more entries, total: ${participants.length}`);
                
                if (moreResult.data.length < pageSize) {
                  hasMore = false;
                } else {
                  offset += pageSize;
                }
              } else {
                hasMore = false;
              }
            } catch (e) {
              console.error('[Participants] Error fetching more entries:', e);
              hasMore = false;
            }
          }
        }
      } else {
        console.log(`[Participants] RPC failed or returned no data, falling back to direct query:`, rpcError);
        
        // Fallback: direct query with pagination to get all entries
        const pageSize = 1000;
        let offset = 0;
        let hasMore = true;
        
        while (hasMore) {
          try {
            const result = await client
              .from('shellies_raffle_entries')
              .select(`
                wallet_address,
                ticket_count,
                points_spent,
                created_at,
                join_tx_hash
              `)
              .eq('raffle_id', raffleId)
              .order('created_at', { ascending: false })
              .range(offset, offset + pageSize - 1);
            
            if (result.data && result.data.length > 0) {
              participants = [...participants, ...result.data];
              console.log(`[Participants] Direct query fetched ${result.data.length} entries (total: ${participants.length}), offset: ${offset}`);
              
              if (result.data.length < pageSize) {
                hasMore = false;
              } else {
                offset += pageSize;
              }
            } else {
              hasMore = false;
            }
            
            participantsError = result.error;
            
          } catch (error: any) {
            // If join_tx_hash column doesn't exist, query without it
            if (error?.code === '42703' || (error?.message && error.message.includes('join_tx_hash'))) {
              const fallbackResult = await client
                .from('shellies_raffle_entries')
                .select(`
                  wallet_address,
                  ticket_count,
                  points_spent,
                  created_at
                `)
                .eq('raffle_id', raffleId)
                .order('created_at', { ascending: false })
                .range(offset, offset + pageSize - 1);
              
              if (fallbackResult.data && fallbackResult.data.length > 0) {
                const mappedData = fallbackResult.data.map((entry: any) => ({
                  ...entry,
                  join_tx_hash: null
                }));
                participants = [...participants, ...mappedData];
                console.log(`[Participants] Fallback query fetched ${fallbackResult.data.length} entries (total: ${participants.length}), offset: ${offset}`);
                
                if (fallbackResult.data.length < pageSize) {
                  hasMore = false;
                } else {
                  offset += pageSize;
                }
              } else {
                hasMore = false;
              }
              
              participantsError = fallbackResult.error;
            } else {
              participantsError = error;
              hasMore = false;
            }
          }
        }
      }
    } catch (error: any) {
      console.error('[Participants] Error in RPC approach:', error);
      participantsError = error;
    }

    if (participantsError) {
      console.error('Error fetching raffle participants:', participantsError);
      return NextResponse.json(
        { error: 'Failed to fetch participants' },
        { status: 500 }
      );
    }

    if (participants.length === 0) {
      console.log(`[Participants] No entries found for raffle ${raffleId}`);
      return NextResponse.json({
        success: true,
        data: [],
        total: 0
      });
    }

    // Group entries by wallet address and sum tickets
    const participantMap = new Map();
    
    console.log(`[Participants] Raw entries count: ${participants?.length || 0}`);
    
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

    console.log(`[Participants] Unique wallets after grouping: ${participantMap.size}`);

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