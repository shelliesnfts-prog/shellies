import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { supabase } from '@/lib/supabase';
import { authOptions } from '@/lib/auth';
import { AdminService } from '@/lib/admin-service';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.address) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Check if user is admin using the admin service
    const isAdmin = await AdminService.isAdmin(session.address);

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    // Fetch all raffle entries with raffle details (wallet_address is now directly in entries table)
    const { data: entries, error: entriesError } = await supabase
      .from('shellies_raffle_entries')
      .select(`
        id,
        wallet_address,
        ticket_count,
        points_spent,
        created_at,
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