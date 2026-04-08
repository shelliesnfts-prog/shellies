import { NextRequest, NextResponse } from 'next/server';
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

/**
 * POST /api/admin/points-config
 * Calls owner-only setters on the ShelliesPoints contract.
 *
 * Body: { action, ...fields }
 * Actions:
 *   set_claim_settings     — claimCooldown, pointsForRegularUser, pointsPerAvailableNFT, maxPointsPerClaim
 *   set_staking_points     — pointsPerDailyStakedNFT, pointsPerWeeklyStakedNFT, pointsPerMonthlyStakedNFT
 *   set_claim_with_fees    — claimWithFeesCostEth, claimWithFeesReward, claimWithFeesCooldown
 *   set_authorized_signer  — authorizedSigner
 *   withdraw_fees          — (no extra fields)
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await checkAdmin();
    if (!admin) return authError(401, 'Not authenticated or not an admin');

    const body = await request.json();
    const { action } = body;

    if (action === 'set_claim_settings') {
      const { claimCooldown, pointsForRegularUser, pointsPerAvailableNFT, maxPointsPerClaim } = body;

      const results: Record<string, string> = {};
      const errors: string[] = [];

      await Promise.all([
        ShelliesPointsService.setClaimCooldown(Number(claimCooldown))
          .then(h => { results.claimCooldownTx = h; })
          .catch(e => errors.push(`setClaimCooldown: ${e instanceof Error ? e.message : String(e)}`)),
        ShelliesPointsService.setPointsForRegularUser(Number(pointsForRegularUser))
          .then(h => { results.pointsForRegularUserTx = h; })
          .catch(e => errors.push(`setPointsForRegularUser: ${e instanceof Error ? e.message : String(e)}`)),
        ShelliesPointsService.setPointsPerAvailableNFT(Number(pointsPerAvailableNFT))
          .then(h => { results.pointsPerAvailableNFTTx = h; })
          .catch(e => errors.push(`setPointsPerAvailableNFT: ${e instanceof Error ? e.message : String(e)}`)),
        ShelliesPointsService.setMaxPointsPerClaim(Number(maxPointsPerClaim))
          .then(h => { results.maxPointsPerClaimTx = h; })
          .catch(e => errors.push(`setMaxPointsPerClaim: ${e instanceof Error ? e.message : String(e)}`)),
      ]);

      if (errors.length > 0) {
        return NextResponse.json({ success: false, error: errors.join('; '), results }, { status: 500 });
      }
      return NextResponse.json({ success: true, results });
    }

    if (action === 'set_staking_points') {
      const { pointsPerDailyStakedNFT, pointsPerWeeklyStakedNFT, pointsPerMonthlyStakedNFT } = body;

      const results: Record<string, string> = {};
      const errors: string[] = [];

      await Promise.all([
        ShelliesPointsService.setPointsPerDailyStakedNFT(Number(pointsPerDailyStakedNFT))
          .then(h => { results.dailyTx = h; })
          .catch(e => errors.push(`setPointsPerDailyStakedNFT: ${e instanceof Error ? e.message : String(e)}`)),
        ShelliesPointsService.setPointsPerWeeklyStakedNFT(Number(pointsPerWeeklyStakedNFT))
          .then(h => { results.weeklyTx = h; })
          .catch(e => errors.push(`setPointsPerWeeklyStakedNFT: ${e instanceof Error ? e.message : String(e)}`)),
        ShelliesPointsService.setPointsPerMonthlyStakedNFT(Number(pointsPerMonthlyStakedNFT))
          .then(h => { results.monthlyTx = h; })
          .catch(e => errors.push(`setPointsPerMonthlyStakedNFT: ${e instanceof Error ? e.message : String(e)}`)),
      ]);

      if (errors.length > 0) {
        return NextResponse.json({ success: false, error: errors.join('; '), results }, { status: 500 });
      }
      return NextResponse.json({ success: true, results });
    }

    if (action === 'set_claim_with_fees') {
      const { claimWithFeesCostEth, claimWithFeesReward, claimWithFeesCooldown } = body;

      const results: Record<string, string> = {};
      const errors: string[] = [];

      await Promise.all([
        ShelliesPointsService.setClaimWithFeesCost(String(claimWithFeesCostEth))
          .then(h => { results.costTx = h; })
          .catch(e => errors.push(`setClaimWithFeesCost: ${e instanceof Error ? e.message : String(e)}`)),
        ShelliesPointsService.setClaimWithFeesReward(Number(claimWithFeesReward))
          .then(h => { results.rewardTx = h; })
          .catch(e => errors.push(`setClaimWithFeesReward: ${e instanceof Error ? e.message : String(e)}`)),
        ShelliesPointsService.setClaimWithFeesCooldown(Number(claimWithFeesCooldown))
          .then(h => { results.cooldownTx = h; })
          .catch(e => errors.push(`setClaimWithFeesCooldown: ${e instanceof Error ? e.message : String(e)}`)),
      ]);

      if (errors.length > 0) {
        return NextResponse.json({ success: false, error: errors.join('; '), results }, { status: 500 });
      }
      return NextResponse.json({ success: true, results });
    }

    if (action === 'set_authorized_signer') {
      const { authorizedSigner } = body;
      if (!authorizedSigner || !/^0x[0-9a-fA-F]{40}$/.test(authorizedSigner)) {
        return NextResponse.json({ error: 'Invalid Ethereum address' }, { status: 400 });
      }
      const tx = await ShelliesPointsService.setAuthorizedSigner(authorizedSigner);
      return NextResponse.json({ success: true, tx });
    }

    if (action === 'withdraw_fees') {
      const tx = await ShelliesPointsService.withdrawFees();
      return NextResponse.json({ success: true, tx });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Error updating points config:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update contract config' },
      { status: 500 }
    );
  }
}
