import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { authOptions } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ raffleId: string }> }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.address) {
      return NextResponse.json({
        success: false,
        error: 'Not authenticated',
        message: 'Please connect your wallet first'
      }, { status: 401 });
    }

    const walletAddress = (session.address as string).toLowerCase();
    const resolvedParams = await params;
    const raffleId = parseInt(resolvedParams.raffleId, 10);
    if (isNaN(raffleId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid raffle ID'
      }, { status: 400 });
    }

    const client = supabaseAdmin || supabase;

    // Try the new wallet_address approach first, fall back to user_id
    let { data: entries, error: entryError } = await client
      .from('shellies_raffle_entries')
      .select('ticket_count, points_spent, created_at')
      .eq('wallet_address', walletAddress)
      .eq('raffle_id', raffleId)
      .order('created_at', { ascending: true });

    // If wallet_address column doesn't exist yet, use user_id approach
    if (entryError && entryError.code === '42703') {
      const { data: user, error: userError } = await client
        .from('shellies_raffle_users')
        .select('id')
        .eq('wallet_address', walletAddress)
        .single();

      if (userError || !user) {
        return NextResponse.json({
          success: true,
          data: null,
          message: 'No entries found'
        });
      }

      const fallbackResult = await client
        .from('shellies_raffle_entries')
        .select('ticket_count, points_spent, created_at')
        .eq('user_id', user.id)
        .eq('raffle_id', raffleId)
        .order('created_at', { ascending: true });

      entries = fallbackResult.data;
      entryError = fallbackResult.error;
    }

    if (entryError && entryError.code !== 'PGRST116') {
      console.error('Error fetching user entries:', entryError);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch user entries'
      }, { status: 500 });
    }

    // Sum up all entries for this raffle and wallet
    if (entries && entries.length > 0) {
      const totalTicketCount = entries.reduce((sum, entry) => sum + entry.ticket_count, 0);
      const totalPointsSpent = entries.reduce((sum, entry) => sum + entry.points_spent, 0);
      const firstEntryDate = entries[0].created_at; // Use first entry date

      return NextResponse.json({
        success: true,
        data: {
          ticket_count: totalTicketCount,
          points_spent: totalPointsSpent,
          created_at: firstEntryDate
        },
        message: 'Entries found'
      });
    }

    return NextResponse.json({
      success: true,
      data: null,
      message: 'No entries found'
    });

  } catch (error) {
    console.error('Error in get user entries:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
