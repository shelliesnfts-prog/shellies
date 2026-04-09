/**
 * Migration script: mint SPTS ERC20 tokens for all wallets with points > 0 in Supabase.
 *
 * Source of truth: shellies_raffle_users.points column in Supabase.
 * Does NOT read the old on-chain contract — Supabase is the canonical balance for migration.
 *
 * Usage:
 *   npx tsx scripts/migrate-points-onchain.ts           # live run
 *   npx tsx scripts/migrate-points-onchain.ts --dry-run # preview only
 *
 * Required env vars:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   OWNER_PRIVATE_KEY              (owner of the new ERC20 ShelliesPoints contract)
 *   SHELLIES_POINTS_ADDRESS        (address of the NEW ERC20 contract, not the old one)
 */

import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';
import * as fs from 'fs';

const isDryRun = process.argv.includes('--dry-run');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ownerPrivateKey = process.env.OWNER_PRIVATE_KEY;
const contractAddress = process.env.SHELLIES_POINTS_ADDRESS;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

if (!isDryRun && (!ownerPrivateKey || !contractAddress)) {
  console.error('Missing OWNER_PRIVATE_KEY or SHELLIES_POINTS_ADDRESS');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log(isDryRun ? '=== DRY RUN — no transactions will be sent ===' : '=== LIVE RUN ===');

  const { data: users, error } = await supabase
    .from('shellies_raffle_users')
    .select('wallet_address, points')
    .gt('points', 0);

  if (error) {
    console.error('Failed to fetch users:', error);
    process.exit(1);
  }

  if (!users || users.length === 0) {
    console.log('No users with points > 0 found.');
    return;
  }

  console.log(`Found ${users.length} wallets with points > 0`);

  let contract: ethers.Contract | null = null;

  if (!isDryRun) {
    const provider = new ethers.JsonRpcProvider('https://rpc-qnd.inkonchain.com');
    const ownerWallet = new ethers.Wallet(ownerPrivateKey!, provider);
    contract = new ethers.Contract(
      contractAddress!,
      ['function adminMint(address user, uint256 amount) external'],
      ownerWallet
    );
  }

  const auditLog: string[] = ['wallet,legacy_points,minted_points,tx_hash'];

  for (const user of users) {
    const legacyPoints = user.points as number;
    const onChainAmount = Math.round(legacyPoints);

    if (onChainAmount <= 0) {
      console.log(`SKIP  ${user.wallet_address}: ${legacyPoints} → rounds to 0`);
      auditLog.push(`${user.wallet_address},${legacyPoints},0,skipped`);
      continue;
    }

    if (isDryRun) {
      console.log(`DRY   ${user.wallet_address}: ${legacyPoints} → ${onChainAmount} pts`);
      auditLog.push(`${user.wallet_address},${legacyPoints},${onChainAmount},dry-run`);
      continue;
    }

    try {
      const tx = await contract!.adminMint(user.wallet_address, BigInt(onChainAmount));
      await tx.wait();
      console.log(`MINT  ${user.wallet_address}: ${legacyPoints} → ${onChainAmount} pts | ${tx.hash}`);
      auditLog.push(`${user.wallet_address},${legacyPoints},${onChainAmount},${tx.hash}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`ERROR ${user.wallet_address}: ${msg}`);
      auditLog.push(`${user.wallet_address},${legacyPoints},${onChainAmount},ERROR: ${msg}`);
    }
  }

  const outputPath = isDryRun ? 'migration-audit-dry.csv' : 'migration-audit.csv';
  fs.writeFileSync(outputPath, auditLog.join('\n'));
  console.log(`\nDone. Audit log saved to ${outputPath}`);
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
