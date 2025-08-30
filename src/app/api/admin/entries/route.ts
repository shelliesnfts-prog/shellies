import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { supabase } from '@/lib/supabase';
import { authOptions } from '../../auth/[...nextauth]/route';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.address) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const { data: adminUser, error: adminError } = await supabase
      .from('shellies_users')
      .select('is_admin')
      .eq('wallet_address', session.address)
      .single();

    if (adminError || !adminUser?.is_admin) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    // Fetch all raffle entries with user and raffle details
    const { data: entries, error: entriesError } = await supabase
      .from('shellies_raffle_entries')
      .select(`
        id,
        tickets_purchased,
        points_spent,
        created_at,
        user:user_id (
          wallet_address
        ),
        raffle:raffle_id (
          title,
          points_per_ticket
        )
      `)
      .order('created_at', { ascending: false });

    if (entriesError) {
      console.error('Error fetching raffle entries:', entriesError);
      return NextResponse.json(
        { error: 'Failed to fetch raffle entries' },
        { status: 500 }
      );
    }

    return NextResponse.json(entries || []);

  } catch (error) {
    console.error('Admin entries API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}