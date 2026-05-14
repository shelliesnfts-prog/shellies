import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { AdminService } from '@/lib/admin-service';
import { ShelliesPointsService } from '@/lib/shellies-points-service';

function authError(status: 401 | 403, msg: string) {
  return NextResponse.json({ error: msg }, { status });
}

async function checkAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.address) return null;
  const isAdmin = await AdminService.isAdmin(session.address);
  return isAdmin ? session.address : null;
}

/**
 * GET /api/admin/points-config
 * Returns all current on-chain config values from the ShelliesPoints contract.
 */
export async function GET() {
  try {
    const admin = await checkAdmin();
    if (!admin) return authError(401, 'Not authenticated or not an admin');

    const config = await ShelliesPointsService.getContractConfig();
    return NextResponse.json({ success: true, config });
  } catch (error) {
    console.error('Error fetching points config:', error);
    return NextResponse.json({ error: 'Failed to fetch contract config' }, { status: 500 });
  }
}

