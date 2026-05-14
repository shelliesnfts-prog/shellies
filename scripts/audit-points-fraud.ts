/**
 * Points Fraud Audit Script
 *
 * Step 1: Pull all wallets from shellies_raffle_users with points >= threshold (default 5000)
 * Step 2: For each wallet, pull their full claiming history from shellies_daily_point_summary
 *         to understand HOW they accumulated those points
 * Step 3: Query on-chain (NFT balance + staking) to see if their holdings justify the balance
 * Step 4: Classify as FRAUD / SUSPICIOUS / LEGITIMATE and print a ranked report
 *
 * Usage:
 *   npx tsx scripts/audit-points-fraud.ts
 *   npx tsx scripts/audit-points-fraud.ts --threshold 3000
 *   npx tsx scripts/audit-points-fraud.ts --csv   # also writes audit-fraud-report.csv
 *
 * Required env vars (auto-loaded from .env / .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import { createPublicClient, http, erc721Abi, defineChain } from 'viem';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// ─── Load env ──────────────────────────────────────────────────────────────────
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

// ─── CLI config ────────────────────────────────────────────────────────────────
const THRESHOLD = (() => {
  const idx = process.argv.indexOf('--threshold');
  return idx !== -1 ? parseInt(process.argv[idx + 1], 10) : 5000;
})();
const WRITE_CSV = process.argv.includes('--csv');

// ─── Contract addresses ────────────────────────────────────────────────────────
const NFT_CONTRACT     = (process.env.NEXT_PUBLIC_SHELLIES_CONTRACT_ADDRESS || '0x1c9838cdC00fA39d953a54c755b95605Ed5Ea49c') as `0x${string}`;
const STAKING_CONTRACT = (process.env.NEXT_PUBLIC_STAKING_CONTRACT_ADDRESS  || '0xB39a48D294E1530a271E712B7A19243679d320D0') as `0x${string}`;

// ─── Points formula (must mirror src/lib/points-constants.ts) ─────────────────
const POINTS_PER_AVAILABLE_NFT      = 5;
const POINTS_PER_DAILY_STAKED_NFT   = 7;
const POINTS_PER_WEEKLY_STAKED_NFT  = 10;
const POINTS_PER_MONTHLY_STAKED_NFT = 20;
const POINTS_FOR_REGULAR_USER       = 1;

// ─── Rate-limit protection ─────────────────────────────────────────────────────
const BATCH_SIZE     = 8;
const BATCH_DELAY_MS = 1000;

// ─── Ink chain + viem clients ──────────────────────────────────────────────────
const inkChain = defineChain({
  id: 57073,
  name: 'Ink',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc-qnd.inkonchain.com'] },
    public:  { http: ['https://rpc-qnd.inkonchain.com', 'https://rpc-gel.inkonchain.com'] },
  },
});

const primaryClient = createPublicClient({
  chain: inkChain,
  transport: http('https://rpc-qnd.inkonchain.com', { timeout: 8000, retryCount: 3, retryDelay: 1500 }),
});
const backupClient = createPublicClient({
  chain: inkChain,
  transport: http('https://rpc-gel.inkonchain.com', { timeout: 10000, retryCount: 2, retryDelay: 2000 }),
});

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Minimal staking ABI ───────────────────────────────────────────────────────
const STAKING_ABI = [
  {
    inputs: [{ internalType: 'address', name: 'user', type: 'address' }],
    name: 'getStakedTokens',
    outputs: [{ internalType: 'uint256[]', name: '', type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    name: 'stakes',
    outputs: [
      { internalType: 'uint256', name: 'tokenId',     type: 'uint256' },
      { internalType: 'address', name: 'owner',       type: 'address' },
      { internalType: 'uint256', name: 'stakedAt',    type: 'uint256' },
      { internalType: 'uint256', name: 'lockEndTime', type: 'uint256' },
      { internalType: 'uint8',   name: 'lockPeriod',  type: 'uint8'   },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// ─── Types ─────────────────────────────────────────────────────────────────────
interface UserRow {
  wallet_address: string;
  points: number;
  last_claim: string | null;
  created_at: string;
}

interface DailySummaryRow {
  date: string;
  total_gained: number;
  num_changes: number;
  final_points: number;
  reasons: string[];
}

interface WalletReport {
  wallet: string;
  dbPoints: number;
  lastClaim: string | null;
  createdAt: string;
  // On-chain
  walletNFTBalance: number;
  stakedNFTCount: number;
  stakedBreakdown: { day: number; week: number; month: number };
  maxLegitPerDay: number;
  onChainError: boolean;
  // Claiming history
  totalDaysClaimed: number;
  totalGainedHistoric: number;
  avgDailyGain: number;
  peakDailyGain: number;
  peakDailyDate: string;
  peakDailyChanges: number;
  peakDailyReasons: string[];
  daysOver1xMax: number;   // days where gain > maxLegitPerDay
  daysOver3xMax: number;   // days where gain > 3× maxLegitPerDay (clear fraud)
  claimTypes: string[];    // unique claim reason types seen
  // Verdict
  fraudMultiplier: number;
  verdict: 'FRAUD' | 'SUSPICIOUS' | 'LEGITIMATE' | 'UNVERIFIED';
  verdictReason: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function callWithFallback<T>(primary: () => Promise<T>, backup: () => Promise<T>): Promise<T> {
  try { return await primary(); }
  catch (e: any) {
    if (e?.message?.includes('429') || e?.message?.includes('rate') || e?.message?.includes('timeout')) {
      await sleep(1000);
      return backup();
    }
    throw e;
  }
}

async function batchedMap<T, R>(
  items: T[],
  fn: (item: T, idx: number) => Promise<R>,
  label = '',
): Promise<(R | null)[]> {
  const results: (R | null)[] = [];
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const chunk = items.slice(i, i + BATCH_SIZE);
    const total = Math.ceil(items.length / BATCH_SIZE);
    const cur   = Math.floor(i / BATCH_SIZE) + 1;
    process.stdout.write(`  [${cur}/${total}] ${label} ${i + 1}–${Math.min(i + BATCH_SIZE, items.length)} of ${items.length}...\r`);
    const settled = await Promise.allSettled(chunk.map((item, j) => fn(item, i + j)));
    for (const r of settled) {
      results.push(r.status === 'fulfilled' ? r.value : null);
    }
    if (i + BATCH_SIZE < items.length) await sleep(BATCH_DELAY_MS);
  }
  process.stdout.write('\n');
  return results;
}

async function getNFTBalance(wallet: `0x${string}`): Promise<number> {
  const bal = await callWithFallback(
    () => primaryClient.readContract({ address: NFT_CONTRACT, abi: erc721Abi, functionName: 'balanceOf', args: [wallet] }),
    () => backupClient.readContract({ address: NFT_CONTRACT, abi: erc721Abi, functionName: 'balanceOf', args: [wallet] }),
  );
  return Number(bal);
}

async function getStakedTokenIds(wallet: `0x${string}`): Promise<number[]> {
  const ids = await callWithFallback(
    () => primaryClient.readContract({ address: STAKING_CONTRACT, abi: STAKING_ABI, functionName: 'getStakedTokens', args: [wallet] }),
    () => backupClient.readContract({ address: STAKING_CONTRACT, abi: STAKING_ABI, functionName: 'getStakedTokens', args: [wallet] }),
  );
  return (ids as bigint[]).map(Number);
}

async function getStakePeriod(tokenId: number): Promise<number> {
  const info = await callWithFallback(
    () => primaryClient.readContract({ address: STAKING_CONTRACT, abi: STAKING_ABI, functionName: 'stakes', args: [BigInt(tokenId)] }),
    () => backupClient.readContract({ address: STAKING_CONTRACT, abi: STAKING_ABI, functionName: 'stakes', args: [BigInt(tokenId)] }),
  );
  const [, , , , lockPeriod] = info as [bigint, string, bigint, bigint, number];
  return lockPeriod;
}

function calcMaxLegitPerDay(walletBalance: number, breakdown: { day: number; week: number; month: number }): number {
  const total = walletBalance + breakdown.day + breakdown.week + breakdown.month;
  if (total === 0) return POINTS_FOR_REGULAR_USER;
  return (
    walletBalance   * POINTS_PER_AVAILABLE_NFT +
    breakdown.day   * POINTS_PER_DAILY_STAKED_NFT +
    breakdown.week  * POINTS_PER_WEEKLY_STAKED_NFT +
    breakdown.month * POINTS_PER_MONTHLY_STAKED_NFT
  );
}

function classify(
  peakDay: number,
  avgDay: number,
  daysOver3x: number,
  maxLegit: number,
  onChainError: boolean,
): { verdict: WalletReport['verdict']; reason: string } {
  if (onChainError) {
    return { verdict: 'UNVERIFIED', reason: 'Blockchain query failed — manual check required' };
  }
  const peakMultiplier = maxLegit > 0 ? peakDay / maxLegit : Infinity;
  const avgMultiplier  = maxLegit > 0 ? avgDay  / maxLegit : Infinity;

  if (daysOver3x >= 3 || peakMultiplier >= 5) {
    return {
      verdict: 'FRAUD',
      reason: `Peak day ${peakDay} pts is ${peakMultiplier.toFixed(1)}× max possible (${maxLegit}). ${daysOver3x} day(s) over 3× max — systematic exploit`,
    };
  }
  if (peakMultiplier >= 2 || avgMultiplier >= 1.5 || daysOver3x >= 1) {
    return {
      verdict: 'SUSPICIOUS',
      reason: `Peak ${peakMultiplier.toFixed(1)}× max, avg ${avgMultiplier.toFixed(1)}× max. ${daysOver3x} day(s) clearly over limit`,
    };
  }
  if (peakMultiplier <= 1.1) {
    return { verdict: 'LEGITIMATE', reason: `Holdings justify balance (max ${maxLegit} pts/day, peak was ${peakDay})` };
  }
  return {
    verdict: 'SUSPICIOUS',
    reason: `Slightly over max possible (${peakMultiplier.toFixed(1)}× on peak day) — verify manually`,
  };
}

// ─── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('='.repeat(72));
  console.log(' Shellies Points Fraud Audit');
  console.log(`  Points threshold : >= ${THRESHOLD} (from shellies_raffle_users.points)`);
  console.log(`  NFT contract     : ${NFT_CONTRACT}`);
  console.log(`  Staking contract : ${STAKING_CONTRACT}`);
  console.log('='.repeat(72));

  // ── STEP 1: All wallets with points >= threshold ────────────────────────────
  console.log(`\n[1/4] Fetching wallets with points >= ${THRESHOLD} from shellies_raffle_users...`);

  const { data: users, error: usersErr } = await supabase
    .from('shellies_raffle_users')
    .select('wallet_address, points, last_claim, created_at')
    .gte('points', THRESHOLD)
    .order('points', { ascending: false });

  if (usersErr) { console.error('❌  DB error:', usersErr.message); process.exit(1); }
  if (!users || users.length === 0) {
    console.log(`✅  No wallets with points >= ${THRESHOLD}. Nothing to audit.`);
    return;
  }

  console.log(`    Found ${users.length} wallet(s) with >= ${THRESHOLD} points.`);

  // ── STEP 2: Pull daily claim history for each wallet ───────────────────────
  console.log('\n[2/4] Pulling claiming history from shellies_daily_point_summary...');

  const wallets = (users as UserRow[]).map(u => u.wallet_address.toLowerCase());

  // Fetch all daily rows for these wallets in one query
  const { data: allDailyRows, error: dailyErr } = await supabase
    .from('shellies_daily_point_summary')
    .select('wallet_address, date, total_gained, num_changes, final_points, reasons')
    .in('wallet_address', wallets)
    .order('total_gained', { ascending: false });

  if (dailyErr) {
    console.warn('  ⚠️  Could not fetch daily summary:', dailyErr.message, '— continuing without history.');
  }

  // Group daily rows by wallet
  const dailyByWallet = new Map<string, DailySummaryRow[]>();
  for (const row of (allDailyRows ?? []) as (DailySummaryRow & { wallet_address: string })[]) {
    const key = row.wallet_address.toLowerCase();
    if (!dailyByWallet.has(key)) dailyByWallet.set(key, []);
    dailyByWallet.get(key)!.push(row);
  }

  // ── STEP 3: Query blockchain for each wallet ───────────────────────────────
  console.log(`\n[3/4] Querying Ink blockchain for ${users.length} wallet(s)...`);

  const reports: WalletReport[] = [];

  await batchedMap(users as UserRow[], async (user) => {
    const wallet = user.wallet_address.toLowerCase();
    const addr   = wallet as `0x${string}`;
    const dailyRows = dailyByWallet.get(wallet) ?? [];

    // ── Daily history aggregation ──────────────────────────────────────────
    const totalGainedHistoric = dailyRows.reduce((s, r) => s + r.total_gained, 0);
    const totalDaysClaimed    = dailyRows.length;
    const avgDailyGain        = totalDaysClaimed > 0 ? totalGainedHistoric / totalDaysClaimed : 0;

    // Find peak day
    const peakRow = dailyRows.reduce<DailySummaryRow | null>((best, r) =>
      !best || r.total_gained > best.total_gained ? r : best, null);

    // Unique claim types across all history
    const allReasons = dailyRows.flatMap(r => r.reasons ?? []);
    const claimTypes = [...new Set(allReasons)];

    // ── On-chain data ──────────────────────────────────────────────────────
    let walletNFTBalance = 0;
    let stakedTokenIds: number[] = [];
    let stakedBreakdown = { day: 0, week: 0, month: 0 };
    let onChainError = false;

    try {
      [walletNFTBalance, stakedTokenIds] = await Promise.all([
        getNFTBalance(addr),
        getStakedTokenIds(addr),
      ]);

      // Get lock period for each staked token
      if (stakedTokenIds.length > 0) {
        const periods = await batchedMap(
          stakedTokenIds,
          (tokenId) => getStakePeriod(tokenId),
          'tokens for',
        );
        for (const p of periods) {
          if (p === null) continue;
          if (p === 0) stakedBreakdown.day++;
          else if (p === 1) stakedBreakdown.week++;
          else if (p === 2) stakedBreakdown.month++;
        }
      }
    } catch (e: any) {
      console.warn(`\n  ⚠️  Chain query failed for ${wallet}: ${e?.message}`);
      onChainError = true;
    }

    const maxLegitPerDay = calcMaxLegitPerDay(walletNFTBalance, stakedBreakdown);

    // Count fraudulent days
    const daysOver1xMax = dailyRows.filter(r => r.total_gained > maxLegitPerDay).length;
    const daysOver3xMax = dailyRows.filter(r => r.total_gained > maxLegitPerDay * 3).length;

    const peakDailyGain    = peakRow?.total_gained ?? 0;
    const peakDailyDate    = peakRow?.date ?? 'N/A';
    const peakDailyChanges = peakRow?.num_changes ?? 0;
    const peakDailyReasons = peakRow?.reasons ?? [];
    const fraudMultiplier  = maxLegitPerDay > 0 ? peakDailyGain / maxLegitPerDay : 999;

    const { verdict, reason } = classify(peakDailyGain, avgDailyGain, daysOver3xMax, maxLegitPerDay, onChainError);

    reports.push({
      wallet,
      dbPoints:      user.points,
      lastClaim:     user.last_claim,
      createdAt:     user.created_at,
      walletNFTBalance,
      stakedNFTCount: stakedTokenIds.length,
      stakedBreakdown,
      maxLegitPerDay,
      onChainError,
      totalDaysClaimed,
      totalGainedHistoric,
      avgDailyGain:   Math.round(avgDailyGain),
      peakDailyGain,
      peakDailyDate,
      peakDailyChanges,
      peakDailyReasons,
      daysOver1xMax,
      daysOver3xMax,
      claimTypes,
      fraudMultiplier,
      verdict,
      verdictReason: reason,
    });
  }, 'wallets');

  // Sort: FRAUD first, then SUSPICIOUS, then by DB points desc
  const order: Record<string, number> = { FRAUD: 0, SUSPICIOUS: 1, UNVERIFIED: 2, LEGITIMATE: 3 };
  reports.sort((a, b) => order[a.verdict] - order[b.verdict] || b.dbPoints - a.dbPoints);

  // ── STEP 4: Print report ───────────────────────────────────────────────────
  console.log('\n[4/4] Results\n');
  console.log('='.repeat(72));

  const byVerdict = (v: string) => reports.filter(r => r.verdict === v);
  const fraud      = byVerdict('FRAUD');
  const suspicious = byVerdict('SUSPICIOUS');
  const unverified = byVerdict('UNVERIFIED');
  const legit      = byVerdict('LEGITIMATE');

  console.log(`  Total wallets audited : ${reports.length}`);
  console.log(`  FRAUD                 : ${fraud.length}`);
  console.log(`  SUSPICIOUS            : ${suspicious.length}`);
  console.log(`  UNVERIFIED            : ${unverified.length}`);
  console.log(`  LEGITIMATE            : ${legit.length}`);
  console.log('='.repeat(72));

  for (const r of reports) {
    const icon = { FRAUD: '🚨', SUSPICIOUS: '⚠️ ', UNVERIFIED: '❓', LEGITIMATE: '✅' }[r.verdict];
    const nftTotal = r.walletNFTBalance + r.stakedNFTCount;

    console.log(`\n${icon} [${r.verdict}] ${r.wallet}`);
    console.log(`     DB points          : ${r.dbPoints}`);
    console.log(`     Account created    : ${r.createdAt?.slice(0, 10)}`);
    console.log(`     Last claim         : ${r.lastClaim?.slice(0, 10) ?? 'never'}`);
    console.log(`   — On-chain holdings —`);
    console.log(`     NFTs in wallet     : ${r.walletNFTBalance}`);
    console.log(`     NFTs staked        : ${r.stakedNFTCount}  (day:${r.stakedBreakdown.day} week:${r.stakedBreakdown.week} month:${r.stakedBreakdown.month})`);
    console.log(`     Total NFTs held    : ${nftTotal}`);
    console.log(`     Max legit pts/day  : ${r.maxLegitPerDay}`);
    console.log(`   — Claiming pattern —`);
    if (r.totalDaysClaimed === 0) {
      console.log(`     History           : No daily summary records found`);
    } else {
      console.log(`     Days recorded      : ${r.totalDaysClaimed}`);
      console.log(`     Total gained (hist): ${r.totalGainedHistoric}`);
      console.log(`     Avg gain / day     : ${r.avgDailyGain} pts`);
      console.log(`     Peak day           : ${r.peakDailyDate} — ${r.peakDailyGain} pts in ${r.peakDailyChanges} write(s)`);
      console.log(`     Peak day reasons   : ${[...new Set(r.peakDailyReasons)].join(', ')}`);
      console.log(`     Days over max      : ${r.daysOver1xMax} (of which ${r.daysOver3xMax} are 3× max)`);
      console.log(`     Claim types seen   : ${r.claimTypes.length > 0 ? r.claimTypes.join(', ') : 'none recorded'}`);
    }
    console.log(`   — Verdict —`);
    console.log(`     Fraud multiplier   : ${r.fraudMultiplier.toFixed(2)}× (peak day vs max possible)`);
    console.log(`     Reason             : ${r.verdictReason}`);
  }

  // ── SQL to delete / reset confirmed frauds ─────────────────────────────────
  if (fraud.length > 0) {
    console.log('\n' + '='.repeat(72));
    console.log(' SQL — Confirmed FRAUD wallets');
    console.log('='.repeat(72));
    console.log('\n-- ⚠️  REVIEW BEFORE RUNNING. Resets off-chain points to 0.');
    console.log('-- The on-chain ShelliesPoints contract is NOT affected by this.\n');
    console.log('UPDATE shellies_raffle_users');
    console.log('SET points = 0, claiming_status = \'available\'');
    console.log('WHERE wallet_address IN (');
    fraud.forEach((r, i) => console.log(`  '${r.wallet}'${i < fraud.length - 1 ? ',' : ''}`));
    console.log(');\n');
  }

  // ── Optional CSV ───────────────────────────────────────────────────────────
  if (WRITE_CSV) {
    const csvPath = path.resolve(__dirname, '../audit-fraud-report.csv');
    const header = [
      'wallet','verdict','db_points','last_claim','created_at',
      'wallet_nft_balance','staked_count','staked_day','staked_week','staked_month',
      'max_legit_per_day','total_days_claimed','total_gained_historic',
      'avg_daily_gain','peak_daily_gain','peak_daily_date','peak_daily_changes',
      'days_over_max','days_over_3x_max','claim_types','fraud_multiplier','verdict_reason',
    ].join(',');
    const csvRows = reports.map(r => [
      r.wallet, r.verdict, r.dbPoints, r.lastClaim ?? '', r.createdAt?.slice(0,10) ?? '',
      r.walletNFTBalance, r.stakedNFTCount, r.stakedBreakdown.day, r.stakedBreakdown.week, r.stakedBreakdown.month,
      r.maxLegitPerDay, r.totalDaysClaimed, r.totalGainedHistoric,
      r.avgDailyGain, r.peakDailyGain, r.peakDailyDate, r.peakDailyChanges,
      r.daysOver1xMax, r.daysOver3xMax,
      `"${r.claimTypes.join('; ')}"`,
      r.fraudMultiplier.toFixed(2),
      `"${r.verdictReason.replace(/"/g, "'")}"`,
    ].join(','));
    fs.writeFileSync(csvPath, [header, ...csvRows].join('\n'));
    console.log(`\n📄  CSV written to: ${csvPath}`);
  }

  console.log('\nDone.\n');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
