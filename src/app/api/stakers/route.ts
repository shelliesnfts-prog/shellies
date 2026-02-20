import { NextRequest, NextResponse } from 'next/server';
import { StakingService } from '@/lib/staking-service';

/**
 * GET /api/stakers
 * Returns a CSV file with all stakers and their staked NFT counts
 * Format: wallet_address,staked_nft_count
 */
export async function GET(request: NextRequest) {
  try {
    // Get all staker addresses from the contract
    const stakers = await StakingService.getAllStakers();

    if (!stakers || stakers.length === 0) {
      return new NextResponse('wallet_address,staked_nft_count\n', {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="stakers.csv"',
        },
      });
    }

    // Fetch staked NFT counts for each staker in parallel
    const stakersWithCounts = await Promise.all(
      stakers.map(async (address) => {
        const stakedTokenIds = await StakingService.getStakedTokenIds(address);
        return {
          address,
          count: stakedTokenIds.length,
        };
      })
    );

    // Generate CSV content
    let csvContent = 'wallet_address,staked_nft_count\n';
    stakersWithCounts.forEach(({ address, count }) => {
      csvContent += `${address},${count}\n`;
    });

    // Return CSV file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="stakers.csv"',
      },
    });

  } catch (error) {
    console.error('Error generating stakers CSV:', error);
    return NextResponse.json(
      { error: 'Failed to generate stakers CSV' },
      { status: 500 }
    );
  }
}
