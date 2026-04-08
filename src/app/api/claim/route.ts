import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ShelliesPointsService } from '@/lib/shellies-points-service';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.address) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const walletAddress = (session.address as string).toLowerCase();

    const [claimStatus, claimWithFeesStatus] = await Promise.all([
      ShelliesPointsService.getClaimStatus(walletAddress),
      ShelliesPointsService.getClaimWithFeesStatus(walletAddress),
    ]);

    return NextResponse.json({
      claim: claimStatus,
      claimWithFees: {
        ...claimWithFeesStatus,
        cost: claimWithFeesStatus.cost.toString(),
      },
    });
  } catch (error) {
    console.error('Error in claim status API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
