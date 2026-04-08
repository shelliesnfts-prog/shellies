import { NextRequest, NextResponse } from 'next/server';
import { StakingService } from '@/lib/staking-service';

/**
 * GET /api/stakers
 * Returns a CSV file with all staker wallet addresses
 * Format: wallet_address
 */
export async function GET(request: NextRequest) {
  try {
    // Get all staker addresses from the contract
    const stakers = await StakingService.getAllStakers();

    if (!stakers || stakers.length === 0) {
      return new NextResponse('wallet_address\n', {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="stakers.csv"',
        },
      });
    }

    // Generate CSV content with just wallet addresses
    let csvContent = 'wallet_address\n';
    stakers.forEach((address) => {
      csvContent += `${address}\n`;
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
      { 
        error: 'Failed to generate stakers CSV',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
