import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { supabase } from '@/lib/supabase';
import { authOptions } from '@/lib/auth';
import { RaffleContractService } from '@/lib/raffle-contract';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // 'active', 'finished', or 'all'
    
    
    // Get session to include user ticket counts if authenticated
    const session = await getServerSession(authOptions);

    // Build the base query with proper JOIN for ticket counts
    let raffleQuery = supabase.from('shellies_raffle_raffles').select('*');
    
    // Always exclude blockchain failed raffles from portal display
    // Currently using CANCELLED status with blockchain_error until enum is updated
    raffleQuery = raffleQuery.or('status.neq.CANCELLED,and(status.eq.CANCELLED,blockchain_error.is.null)');
    
    // Always exclude hidden raffles from portal display
    raffleQuery = raffleQuery.or('is_hidden.is.null,is_hidden.eq.false');
    
    // Filter by status if specified
    if (status === 'active') {
      raffleQuery = raffleQuery.eq('status', 'ACTIVE');
    } else if (status === 'finished') {
      raffleQuery = raffleQuery.in('status', ['COMPLETED', 'CANCELLED']);
    }
    
    raffleQuery = raffleQuery.order('created_at', { ascending: false });

    const { data: raffles, error: rafflesError } = await raffleQuery;

    if (rafflesError) {
      console.error('❌ Error fetching raffles:', rafflesError);
      return NextResponse.json({ error: 'Failed to fetch raffles' }, { status: 500 });
    }


    // Get winner information for finished raffles
    let winnerInfo: Record<string, string> = {};
    if (raffles && raffles.length > 0) {
      const finishedRaffles = raffles.filter(r => r.status === 'COMPLETED');
      if (finishedRaffles.length > 0) {
        
        const winnerPromises = finishedRaffles.map(async (raffle) => {
          try {
            const raffleInfo = await RaffleContractService.getRafflePrizeInfo(raffle.id.toString());
            if (raffleInfo && raffleInfo.winner && raffleInfo.winner !== '0x0000000000000000000000000000000000000000') {
              return { raffleId: raffle.id, winner: raffleInfo.winner };
            }
          } catch (error) {
            console.error(`❌ Error fetching winner for raffle ${raffle.id}:`, error);
          }
          return { raffleId: raffle.id, winner: null };
        });
        
        const winnerResults = await Promise.all(winnerPromises);
        winnerInfo = winnerResults.reduce((acc: Record<string, string>, item) => {
          if (item.winner) {
            acc[item.raffleId] = item.winner;
          }
          return acc;
        }, {});
        
      }
    }

    // Get participant counts for all raffles
    let participantCounts: Record<string, number> = {};
    if (raffles && raffles.length > 0) {
      try {
        const raffleIds = raffles.map(r => r.id);
        const { data: participantData, error: participantError } = await supabase
          .rpc('get_raffle_participant_counts', {
            p_raffle_ids: raffleIds
          });


        if (!participantError && participantData) {
          participantCounts = participantData.reduce((acc: Record<string, number>, item: any) => {
            acc[item.raffle_id] = item.participant_count;
            return acc;
          }, {});
        } else if (participantError && participantError.code === '42883') {
          
          // Fallback: manual query to count distinct wallet addresses per raffle
          try {
            const participantPromises = raffleIds.map(async (raffleId) => {
              const { data: participantData, error } = await supabase
                .from('shellies_raffle_entries')
                .select('wallet_address', { count: 'exact' })
                .eq('raffle_id', raffleId);
              
              if (!error && participantData) {
                // Count unique wallet addresses
                const uniqueWallets = new Set(participantData.map(entry => entry.wallet_address));
                return { raffle_id: raffleId, participant_count: uniqueWallets.size };
              }
              return { raffle_id: raffleId, participant_count: 0 };
            });
            
            const fallbackResults = await Promise.all(participantPromises);
            participantCounts = fallbackResults.reduce((acc: Record<string, number>, item: any) => {
              acc[item.raffle_id] = item.participant_count;
              return acc;
            }, {});
            
          } catch (fallbackError) {
            console.error('❌ Error in participant count fallback:', fallbackError);
          }
        }
      } catch (error) {
        console.error('❌ Error fetching participant counts:', error);
      }
    }

    // If user is authenticated, use a single query with JOIN to get ticket counts
    if (session?.address && raffles && raffles.length > 0) {
      try {

        // Try the optimized approach with SQL query using RPC
        const raffleIds = raffles.map(r => r.id);

        // First try the new schema function (using wallet_address directly)
        let { data: userTicketData, error: ticketError } = await supabase
          .rpc('get_user_raffle_tickets_new', {
            p_wallet_address: session.address,
            p_raffle_ids: raffleIds
          });


        // If new RPC doesn't exist, try the old RPC function as fallback
        if (ticketError && ticketError.code === '42883') {
          
          const { data: oldRpcData, error: oldRpcError } = await supabase
            .rpc('get_user_raffle_tickets', {
              p_wallet_address: session.address,
              p_raffle_ids: raffleIds
            });


          if (!oldRpcError) {
            userTicketData = oldRpcData;
          } else {
            
            // Try wallet_address column first (direct approach)
            let { data: userEntries, error: walletError } = await supabase
              .from('shellies_raffle_entries')
              .select('raffle_id, ticket_count')
              .eq('wallet_address', session.address)
              .in('raffle_id', raffleIds);


            if (!walletError) {
              // Convert to the format expected by the rest of the function
              userTicketData = userEntries?.map(entry => ({
                raffle_id: entry.raffle_id,
                total_tickets: entry.ticket_count
              })) || [];
            } else if (walletError.code === '42703') {
              
              // Get user ID first
              const { data: user } = await supabase
                .from('shellies_raffle_users')
                .select('id')
                .eq('wallet_address', session.address)
                .single();


              if (user) {
                const { data: fallbackEntries, error: fallbackError } = await supabase
                  .from('shellies_raffle_entries')
                  .select('raffle_id, ticket_count')
                  .eq('user_id', user.id)
                  .in('raffle_id', raffleIds);
                
                
                if (!fallbackError) {
                  userTicketData = fallbackEntries?.map(entry => ({
                    raffle_id: entry.raffle_id,
                    total_tickets: entry.ticket_count
                  })) || [];
                }
              }
            }
          }
        }

        // Sum ticket counts by raffle_id (in case there are multiple entries per raffle)
        const entriesMap = userTicketData?.reduce((acc: Record<string, number>, entry: any) => {
          const raffleId = entry.raffle_id;
          const ticketCount = entry.total_tickets || entry.ticket_count || 0;
          acc[raffleId] = (acc[raffleId] || 0) + ticketCount;
          return acc;
        }, {}) || {};


        // Add user_ticket_count, current_participants, and winner to each raffle
        const rafflesWithTicketCounts = raffles.map(raffle => ({
          ...raffle,
          user_ticket_count: entriesMap[raffle.id] || 0,
          current_participants: participantCounts[raffle.id] || 0,
          winner: winnerInfo[raffle.id] || null
        }));


        return NextResponse.json(rafflesWithTicketCounts);
        
      } catch (error) {
        console.error('❌ Error fetching user ticket counts:', error);
        // Continue without ticket counts rather than failing completely
      }
    }

    // If not authenticated or no user found, return raffles with 0 ticket counts but include participant counts and winner
    const rafflesWithZeroTickets = raffles?.map(raffle => ({
      ...raffle,
      user_ticket_count: 0,
      current_participants: participantCounts[raffle.id] || 0,
      winner: winnerInfo[raffle.id] || null
    })) || [];

    return NextResponse.json(rafflesWithZeroTickets);
  } catch (error) {
    console.error('❌ Error in raffles API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}