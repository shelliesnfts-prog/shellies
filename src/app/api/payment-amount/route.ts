import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin, supabase } from '@/lib/supabase';
import { NFTService } from '@/lib/nft-service';
import { StakingService } from '@/lib/staking-service';

/**
 * GET /api/payment-amount
 * Get payment amount for current user based on staking status and NFT ownership
 * Returns tier-specific pricing
 * Priority: Staker > NFT Holder > Regular
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.address) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Check staking status and NFT ownership in parallel
    const [isStaker, nftCount] = await Promise.all([
      StakingService.isStaker(session.address),
      NFTService.getNFTCount(session.address)
    ]);

    const isNFTHolder = nftCount > 0;

    // Determine tier based on priority: Staker > NFT Holder > Regular
    let tierName = 'regular';
    if (isStaker) {
      tierName = 'staker';
    } else if (isNFTHolder) {
      tierName = 'nft_holder';
    }

    // Use admin client if available, otherwise fallback to regular client
    const client = supabaseAdmin || supabase;

    // Fetch the specific tier
    const { data: tier, error } = await client
      .from('payment_tiers')
      .select('*')
      .eq('tier_name', tierName)
      .eq('is_active', true)
      .single();

    if (error || !tier) {
      console.error('Error fetching payment tier:', error);
      
      // Fallback to default values if database fails
      const fallbackAmounts: Record<string, string> = {
        staker: '2000000000000',
        nft_holder: '5000000000000',
        regular: '10000000000000'
      };
      
      return NextResponse.json({
        payment_amount_wei: fallbackAmounts[tierName],
        tier: tierName,
        is_staker: isStaker,
        is_nft_holder: isNFTHolder,
        nft_count: nftCount,
        fallback: true,
      });
    }

    return NextResponse.json({
      payment_amount_wei: tier.payment_amount_wei,
      tier: tier.tier_name,
      tier_description: tier.description,
      is_staker: isStaker,
      is_nft_holder: isNFTHolder,
      nft_count: nftCount,
      fallback: false,
    });
  } catch (error) {
    console.error('Unexpected error fetching payment amount:', error);
    
    // Return safe fallback
    return NextResponse.json({
      payment_amount_wei: '10000000000000', // Regular amount
      tier: 'regular',
      is_staker: false,
      is_nft_holder: false,
      nft_count: 0,
      fallback: true,
      error: 'Failed to determine tier, using default',
    });
  }
}
