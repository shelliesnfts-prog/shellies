import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin, supabase } from '@/lib/supabase';

/**
 * GET /api/payment-tiers
 * Fetch all payment tiers (active and inactive for admin)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const client = supabaseAdmin || supabase;

    let query = client
      .from('payment_tiers')
      .select('*')
      .order('min_nfts', { ascending: true });

    // Only filter by active if not including inactive
    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching payment tiers:', error);
      return NextResponse.json(
        { error: 'Failed to fetch payment tiers' },
        { status: 500 }
      );
    }

    return NextResponse.json({ tiers: data || [] });
  } catch (error) {
    console.error('Unexpected error fetching payment tiers:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/payment-tiers
 * Create a new payment tier (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    // Check admin authentication
    const session = await getServerSession(authOptions);
    
    if (!session?.address) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const { AdminService } = await import('@/lib/admin-service');
    const isAdmin = await AdminService.isAdmin(session.address);
    
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }

    const { tier_name, payment_amount_wei, min_nfts, max_nfts, description } = await request.json();

    // Validate required fields
    if (!tier_name || !payment_amount_wei || min_nfts === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: tier_name, payment_amount_wei, min_nfts' },
        { status: 400 }
      );
    }

    // Validate payment amount
    if (payment_amount_wei === '0') {
      return NextResponse.json(
        { error: 'Payment amount must be greater than 0' },
        { status: 400 }
      );
    }

    // Validate NFT range
    if (min_nfts < 0) {
      return NextResponse.json(
        { error: 'min_nfts must be >= 0' },
        { status: 400 }
      );
    }

    if (max_nfts !== null && max_nfts !== undefined && max_nfts < min_nfts) {
      return NextResponse.json(
        { error: 'max_nfts must be >= min_nfts' },
        { status: 400 }
      );
    }

    const client = supabaseAdmin || supabase;

    // Insert new tier
    const { data, error } = await client
      .from('payment_tiers')
      .insert({
        tier_name: tier_name.toLowerCase().replace(/\s+/g, '_'),
        payment_amount_wei,
        min_nfts,
        max_nfts: max_nfts === '' ? null : max_nfts,
        description: description || `${tier_name} tier`,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating payment tier:', error);
      
      if (error.code === '23505') { // Unique constraint violation
        return NextResponse.json(
          { error: 'A tier with this name already exists' },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { error: 'Failed to create payment tier' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true,
      tier: data 
    });
  } catch (error) {
    console.error('Unexpected error creating payment tier:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
