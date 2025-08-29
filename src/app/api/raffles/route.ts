import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // 'active', 'finished', or 'all'
    
    let query = supabase
      .from('shellies_raffle_raffles')
      .select('*')
      .order('created_at', { ascending: false });

    // Filter by status if specified
    if (status === 'active') {
      query = query
        .eq('is_active', true)
        .gt('end_date', new Date().toISOString());
    } else if (status === 'finished') {
      query = query.or(`is_active.eq.false,end_date.lt.${new Date().toISOString()}`);
    }

    const { data: raffles, error } = await query;

    if (error) {
      console.error('Error fetching raffles:', error);
      return NextResponse.json({ error: 'Failed to fetch raffles' }, { status: 500 });
    }

    return NextResponse.json(raffles || []);
  } catch (error) {
    console.error('Error in raffles API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}