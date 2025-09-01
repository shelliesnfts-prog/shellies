import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { supabase } from '@/lib/supabase';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // 'active', 'finished', or 'all'
    
    console.log('🎫 Raffles API called with status:', status);
    
    // Get session to include user ticket counts if authenticated
    const session = await getServerSession(authOptions);
    console.log('🔐 Session wallet address:', session?.address || 'Not authenticated');

    // Build the base query with proper JOIN for ticket counts
    let raffleQuery = supabase.from('shellies_raffle_raffles').select('*');
    
    // Filter by status if specified
    if (status === 'active') {
      raffleQuery = raffleQuery.gt('end_date', new Date().toISOString());
    } else if (status === 'finished') {
      raffleQuery = raffleQuery.lt('end_date', new Date().toISOString());
    }
    
    raffleQuery = raffleQuery.order('created_at', { ascending: false });

    const { data: raffles, error: rafflesError } = await raffleQuery;

    if (rafflesError) {
      console.error('❌ Error fetching raffles:', rafflesError);
      return NextResponse.json({ error: 'Failed to fetch raffles' }, { status: 500 });
    }

    console.log(`📋 Fetched ${raffles?.length || 0} raffles`);

    // Get participant counts for all raffles
    let participantCounts: Record<string, number> = {};
    if (raffles && raffles.length > 0) {
      try {
        const raffleIds = raffles.map(r => r.id);
        const { data: participantData, error: participantError } = await supabase
          .rpc('get_raffle_participant_counts', {
            p_raffle_ids: raffleIds
          });

        console.log('👥 Participant counts result:', participantData, 'Error:', participantError);

        if (!participantError && participantData) {
          participantCounts = participantData.reduce((acc: Record<string, number>, item: any) => {
            acc[item.raffle_id] = item.participant_count;
            return acc;
          }, {});
        } else if (participantError && participantError.code === '42883') {
          console.log('📞 Participant count RPC not found, using manual fallback...');
          
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
            
            console.log('👥 Fallback participant counts:', participantCounts);
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
        console.log('🔍 Fetching ticket counts for authenticated user...');

        // Try the optimized approach with SQL query using RPC
        const raffleIds = raffles.map(r => r.id);
        console.log('🎯 Raffle IDs to check:', raffleIds);

        // First try the new schema function (using wallet_address directly)
        let { data: userTicketData, error: ticketError } = await supabase
          .rpc('get_user_raffle_tickets_new', {
            p_wallet_address: session.address,
            p_raffle_ids: raffleIds
          });

        console.log('🎫 New RPC result:', userTicketData, 'Error:', ticketError);

        // If new RPC doesn't exist, try the old RPC function as fallback
        if (ticketError && ticketError.code === '42883') {
          console.log('📞 New RPC not found, trying old RPC fallback...');
          
          const { data: oldRpcData, error: oldRpcError } = await supabase
            .rpc('get_user_raffle_tickets', {
              p_wallet_address: session.address,
              p_raffle_ids: raffleIds
            });

          console.log('🎫 Old RPC result:', oldRpcData, 'Error:', oldRpcError);

          if (!oldRpcError) {
            userTicketData = oldRpcData;
          } else {
            console.log('📞 Old RPC also failed, trying manual approach...');
            
            // Try wallet_address column first (direct approach)
            let { data: userEntries, error: walletError } = await supabase
              .from('shellies_raffle_entries')
              .select('raffle_id, ticket_count')
              .eq('wallet_address', session.address)
              .in('raffle_id', raffleIds);

            console.log('🎫 Wallet_address query result:', userEntries, 'Error:', walletError);

            if (!walletError) {
              // Convert to the format expected by the rest of the function
              userTicketData = userEntries?.map(entry => ({
                raffle_id: entry.raffle_id,
                total_tickets: entry.ticket_count
              })) || [];
            } else if (walletError.code === '42703') {
              console.log('📞 Wallet_address column not found, using user_id fallback...');
              
              // Get user ID first
              const { data: user } = await supabase
                .from('shellies_raffle_users')
                .select('id')
                .eq('wallet_address', session.address)
                .single();

              console.log('👤 Found user:', user);

              if (user) {
                const { data: fallbackEntries, error: fallbackError } = await supabase
                  .from('shellies_raffle_entries')
                  .select('raffle_id, ticket_count')
                  .eq('user_id', user.id)
                  .in('raffle_id', raffleIds);
                
                console.log('🎫 User_id fallback result:', fallbackEntries, 'Error:', fallbackError);
                
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

        console.log('📊 Final ticket counts map:', entriesMap);

        // Add user_ticket_count and current_participants to each raffle
        const rafflesWithTicketCounts = raffles.map(raffle => ({
          ...raffle,
          user_ticket_count: entriesMap[raffle.id] || 0,
          current_participants: participantCounts[raffle.id] || 0
        }));

        console.log('🎫 Final raffles with ticket and participant counts:', rafflesWithTicketCounts.map(r => ({
          title: r.title,
          id: r.id,
          user_ticket_count: r.user_ticket_count,
          current_participants: r.current_participants,
          max_participants: r.max_participants
        })));

        return NextResponse.json(rafflesWithTicketCounts);
        
      } catch (error) {
        console.error('❌ Error fetching user ticket counts:', error);
        // Continue without ticket counts rather than failing completely
      }
    }

    // If not authenticated or no user found, return raffles with 0 ticket counts but include participant counts
    const rafflesWithZeroTickets = raffles?.map(raffle => ({
      ...raffle,
      user_ticket_count: 0,
      current_participants: participantCounts[raffle.id] || 0
    })) || [];

    console.log('🎫 Returning raffles with zero tickets for unauthenticated user');
    return NextResponse.json(rafflesWithZeroTickets);
  } catch (error) {
    console.error('❌ Error in raffles API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}