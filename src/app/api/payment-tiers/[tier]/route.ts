import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * PUT /api/payment-tiers/[tier]
 * Update payment tier (admin only)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ tier: string }> }
) {
  try {
    // Check admin authentication
    const session = await getServerSession(authOptions);
    
    if (!session?.isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    const { tier } = await params;
    const body = await request.json();
    const { payment_amount_wei, min_nfts, max_nfts, description, is_active } = body;

    // Build update object with only provided fields
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (payment_amount_wei !== undefined) {
      if (payment_amount_wei === '0') {
        return NextResponse.json(
          { error: 'Invalid payment amount' },
          { status: 400 }
        );
      }
      updateData.payment_amount_wei = payment_amount_wei;
    }

    if (min_nfts !== undefined) updateData.min_nfts = min_nfts;
    if (max_nfts !== undefined) updateData.max_nfts = max_nfts;
    if (description !== undefined) updateData.description = description;
    if (is_active !== undefined) updateData.is_active = is_active;

    // Update the tier
    const { data, error } = await supabaseAdmin
      .from('payment_tiers')
      .update(updateData)
      .eq('tier_name', tier)
      .select()
      .single();

    if (error) {
      console.error('Error updating payment tier:', error);
      return NextResponse.json(
        { error: 'Failed to update payment tier' },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Payment tier not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ 
      success: true,
      tier: data 
    });
  } catch (error) {
    console.error('Unexpected error updating payment tier:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/payment-tiers/[tier]
 * Delete a payment tier (admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ tier: string }> }
) {
  try {
    // Check admin authentication
    const session = await getServerSession(authOptions);
    
    if (!session?.isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    const { tier } = await params;

    // Prevent deleting the regular tier
    if (tier === 'regular') {
      return NextResponse.json(
        { error: 'Cannot delete the regular tier' },
        { status: 400 }
      );
    }

    // Delete the tier
    const { error } = await supabaseAdmin
      .from('payment_tiers')
      .delete()
      .eq('tier_name', tier);

    if (error) {
      console.error('Error deleting payment tier:', error);
      return NextResponse.json(
        { error: 'Failed to delete payment tier' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true,
      message: 'Tier deleted successfully'
    });
  } catch (error) {
    console.error('Unexpected error deleting payment tier:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
