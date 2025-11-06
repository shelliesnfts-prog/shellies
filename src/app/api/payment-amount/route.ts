import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin, supabase } from '@/lib/supabase';
import { NFTService } from '@/lib/nft-service';

/**
 * GET /api/payment-amount
 * Get payment amount for current user based on NFT ownership
 * Returns tier-specific pricing
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

    // Check NFT ownership
    const nftCount = await NFTService.getNFTCount(session.address);
    const isNFTHolder = nftCount > 0;

    // Use admin client if available, otherwise fallback to regular client
    const client = supabaseAdmin || supabase;

    // Fetch all active tiers and find the best match based on NFT count
    const { data: allTiers, error } = await client
      .from('payment_tiers')
      .select('*')
      .eq('is_active', true)
      .order('min_nfts', { ascending: false }); // Order by min_nfts descending to check highest tiers first

    if (error || !allTiers || allTiers.length === 0) {
      console.error('Error fetching payment tiers:', error);
      
      // Fallback to default values if database fails
      const fallbackAmount = isNFTHolder ? '5000000000000' : '10000000000000';
      
      return NextResponse.json({
        payment_amount_wei: fallbackAmount,
        tier: isNFTHolder ? 'bronze' : 'regular',
        is_nft_holder: isNFTHolder,
        nft_count: nftCount,
        fallback: true,
      });
    }

    // Find the appropriate tier based on NFT count
    // Check from highest tier to lowest
    let matchedTier = null;
    for (const tier of allTiers) {
      const meetsMinimum = nftCount >= tier.min_nfts;
      const meetsMaximum = tier.max_nfts === null || nftCount <= tier.max_nfts;
      
      if (meetsMinimum && meetsMaximum) {
        matchedTier = tier;
        break;
      }
    }

    // If no tier matched, use regular tier as fallback
    if (!matchedTier) {
      matchedTier = allTiers.find(t => t.tier_name === 'regular') || allTiers[allTiers.length - 1];
    }

    const data = matchedTier;

    if (!data) {
      console.error('Error: No tier data found');
      
      // Fallback to default values if database fails
      const fallbackAmount = isNFTHolder ? '5000000000000' : '10000000000000';
      
      return NextResponse.json({
        payment_amount_wei: fallbackAmount,
        tier: isNFTHolder ? 'bronze' : 'regular',
        is_nft_holder: isNFTHolder,
        nft_count: nftCount,
        fallback: true,
      });
    }

    return NextResponse.json({
      payment_amount_wei: data.payment_amount_wei,
      tier: data.tier_name,
      tier_description: data.description,
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
      is_nft_holder: false,
      nft_count: 0,
      fallback: true,
      error: 'Failed to determine tier, using default',
    });
  }
}
