'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { useAccount } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { PortalSidebar } from '@/components/portal/PortalSidebar';
import { useTheme } from '@/contexts/ThemeContext';
import { usePoints } from '@/contexts/PointsContext';
import { useClaiming } from '@/hooks/useClaiming';
import { useNftAndStaking } from '@/hooks/useNftAndStaking';
import { useInkEthPrice } from '@/hooks/useInkEthPrice';
import XPBridge from '@/components/XPBridge';
import { ClaimPageSkeleton } from '@/components/portal/ClaimPageSkeleton';
import { SHELLIES_POINTS_ADDRESS } from '@/lib/shellies-points-contract';
import { formatEther } from 'viem';
import { Gift, Zap, Target } from 'lucide-react';

const EXPLORER_BASE_URL = 'https://explorer.inkonchain.com';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const BURNED_POINTS_CACHE_PREFIX = 'shellies:burned-points:';
const BURNED_POINTS_FRESH_MS = 60 * 60 * 1000;
const BURNED_POINTS_MAX_CACHE_MS = 24 * 60 * 60 * 1000;
const BURNED_POINTS_FETCH_TIMEOUT_MS = 45_000;
const BURNED_POINTS_PAGE_SIZE = 10000;
const BURNED_POINTS_MAX_PAGES = 25;

function formatTimer(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (s > 0) parts.push(`${s}s`);
  return parts.length > 0 ? parts.join(' ') : '0s';
}

function formatUsdEth(value: bigint, ethPrice: number | null): string {
  const eth = Number(formatEther(value));
  if (ethPrice) return `$${(eth * ethPrice).toFixed(4)}`;
  return `${eth.toFixed(6)} ETH`;
}

function getUserCategory(nftCount: number, stakingTotal: number) {
  if (stakingTotal > 0) return 'staker' as const;
  if (nftCount > 0) return 'holder' as const;
  return 'regular' as const;
}

function formatPointSupply(value: bigint): string {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function parsePointSupply(value: unknown): bigint | null {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.trunc(value));
  if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value);
  return null;
}

type BurnedPointsCache = {
  updatedAt: number;
  value: string;
};

type TokenTransfer = {
  contractAddress?: string;
  to?: string;
  value?: string;
};

type TokenTransfersResponse = {
  result?: TokenTransfer[];
};

function getBurnedPointsCacheKey(contractAddress: string): string {
  return `${BURNED_POINTS_CACHE_PREFIX}${contractAddress.toLowerCase()}`;
}

function readCachedBurnedPoints(contractAddress: string): { updatedAt: number; value: bigint } | null {
  try {
    const raw = window.localStorage.getItem(getBurnedPointsCacheKey(contractAddress));
    if (!raw) return null;

    const cached = JSON.parse(raw) as Partial<BurnedPointsCache>;
    const value = parsePointSupply(cached.value);
    const updatedAt = Number(cached.updatedAt);

    if (value == null || !Number.isFinite(updatedAt)) return null;
    if (Date.now() - updatedAt > BURNED_POINTS_MAX_CACHE_MS) return null;

    return { updatedAt, value };
  } catch {
    return null;
  }
}

function writeCachedBurnedPoints(contractAddress: string, value: bigint) {
  try {
    const cached: BurnedPointsCache = {
      updatedAt: Date.now(),
      value: value.toString(),
    };
    window.localStorage.setItem(getBurnedPointsCacheKey(contractAddress), JSON.stringify(cached));
  } catch {
    // Storage can be unavailable in private browsing or strict browser settings.
  }
}

async function fetchTotalBurnedFromExplorer(contractAddress: string, signal: AbortSignal): Promise<bigint> {
  let totalBurned = BigInt(0);
  const normalizedContract = contractAddress.toLowerCase();

  for (let page = 1; page <= BURNED_POINTS_MAX_PAGES; page += 1) {
    const url = new URL('/api', EXPLORER_BASE_URL);
    url.searchParams.set('module', 'account');
    url.searchParams.set('action', 'tokentx');
    url.searchParams.set('address', ZERO_ADDRESS);
    url.searchParams.set('contractaddress', contractAddress);
    url.searchParams.set('page', String(page));
    url.searchParams.set('offset', String(BURNED_POINTS_PAGE_SIZE));
    url.searchParams.set('sort', 'asc');

    const response = await fetch(url.toString(), { signal });

    if (!response.ok) {
      throw new Error(`Explorer token transfers request failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as TokenTransfersResponse;
    const transfers = Array.isArray(data.result) ? data.result : [];

    for (const transfer of transfers) {
      const isBurn =
        transfer.to?.toLowerCase() === ZERO_ADDRESS &&
        transfer.contractAddress?.toLowerCase() === normalizedContract;

      if (!isBurn) continue;

      try {
        totalBurned += BigInt(transfer.value ?? '0');
      } catch {
        // Ignore malformed explorer rows and keep summing valid burn transfers.
      }
    }

    if (transfers.length < BURNED_POINTS_PAGE_SIZE) {
      break;
    }
  }

  return totalBurned;
}

function getSupplyPercent(totalSupply: bigint, maxSupply: bigint): number {
  if (maxSupply <= BigInt(0)) return 0;
  const cappedTotal = totalSupply > maxSupply ? maxSupply : totalSupply;
  return Number((cappedTotal * BigInt(10000)) / maxSupply) / 100;
}

function SupplyProgressCard({
  totalSupply,
  maxSupply,
  maxSupplySet,
  holdersCount,
  totalBurned,
  totalBurnedLoading,
  isDarkMode,
}: {
  totalSupply: bigint;
  maxSupply: bigint;
  maxSupplySet: boolean;
  holdersCount: number | null;
  totalBurned: bigint | null;
  totalBurnedLoading: boolean;
  isDarkMode: boolean;
}) {
  const percent = maxSupplySet ? getSupplyPercent(totalSupply, maxSupply) : 0;
  const displayPercent = maxSupplySet ? `${percent.toFixed(percent >= 10 ? 1 : 2)}%` : 'Uncapped';
  const progressWidth = maxSupplySet ? `${Math.min(100, percent)}%` : '0%';
  const burnedValue =
    totalBurnedLoading && totalBurned == null ? (
      <span className="inline-flex h-5 items-center" aria-label="Loading burned points">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      </span>
    ) : totalBurned == null ? (
      '—'
    ) : (
      formatPointSupply(totalBurned)
    );
  const supplyStats: { label: string; value: ReactNode }[] = [
    { label: 'Claimed', value: formatPointSupply(totalSupply) },
    { label: 'Max Supply', value: maxSupplySet ? formatPointSupply(maxSupply) : 'Not set' },
    { label: 'Burned', value: burnedValue },
    { label: 'Unique Holders', value: holdersCount == null ? '—' : holdersCount.toLocaleString() },
  ];

  return (
    <section
      className={`rounded-2xl border overflow-hidden ${
        isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}
    >
      <div className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-xl ${isDarkMode ? 'bg-cyan-500/15' : 'bg-cyan-50'}`}>
              <Target className={`w-4 h-4 ${isDarkMode ? 'text-cyan-300' : 'text-cyan-700'}`} />
            </div>
            <div>
              <h2 className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Points Supply Progress
              </h2>
              <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                Claimed SPTS against the owner-set maximum supply
              </p>
            </div>
          </div>

          <div
            className={`self-start rounded-full border px-3 py-1 text-xs font-semibold tabular-nums ${
              isDarkMode ? 'border-cyan-400/20 bg-cyan-400/10 text-cyan-200' : 'border-cyan-200 bg-cyan-50 text-cyan-700'
            }`}
          >
            {displayPercent}
          </div>
        </div>

        <div className="mt-5">
          <div
            className={`relative h-3 overflow-hidden rounded-full ${
              isDarkMode ? 'bg-gray-900 ring-1 ring-gray-700' : 'bg-gray-100 ring-1 ring-gray-200'
            }`}
            role="progressbar"
            aria-valuenow={maxSupplySet ? Math.round(percent) : 0}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Claimed points supply progress"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-teal-400 to-green-500 shadow-[0_0_18px_rgba(34,211,238,0.35)] transition-all duration-700 ease-out"
              style={{ width: progressWidth }}
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {supplyStats.map(({ label, value }) => (
              <div
                key={label}
                className={`rounded-xl border p-3 ${isDarkMode ? 'border-gray-700 bg-gray-900/40' : 'border-gray-200 bg-gray-50'}`}
              >
                <div className={`text-[10px] font-semibold uppercase tracking-wider ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  {label}
                </div>
                <div className={`mt-1 text-lg font-bold tabular-nums leading-none ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Shared TierCard ─────────────────────────────────────────────────────────
// Both Daily Rewards and Instant Points use this exact component so height
// and structure are guaranteed to be identical.

type TierRow = { label: string; value: string };

function TierCard({
  label,
  isActive,
  pts,
  ptsLabel,
  rows,
  accent,
  isDarkMode,
}: {
  label: string;
  isActive: boolean;
  /** Main number shown large */
  pts: number | string;
  /** Small text under the number, e.g. "pts / day" */
  ptsLabel: string;
  /** Exactly 2 label/value rows below the divider */
  rows: [TierRow, TierRow];
  accent: 'green' | 'amber';
  isDarkMode: boolean;
}) {
  const ptsDisplay =
    typeof pts === 'number'
      ? pts % 1 !== 0 ? pts.toFixed(1) : String(pts)
      : pts;

  // Concrete class strings so Tailwind includes them at build time
  const activeBorder =
    accent === 'green'
      ? isDarkMode ? 'border-green-500/50' : 'border-green-400'
      : isDarkMode ? 'border-amber-500/50' : 'border-amber-400';

  const inactiveBorder = isDarkMode ? 'border-gray-700/60' : 'border-gray-200';

  const activeBg = isDarkMode ? 'bg-gray-800' : 'bg-white';
  const inactiveBg = isDarkMode ? 'bg-gray-800/40' : 'bg-gray-50';

  const accentText =
    accent === 'green'
      ? isDarkMode ? 'text-green-400' : 'text-green-700'
      : isDarkMode ? 'text-amber-400' : 'text-amber-600';

  const accentBadge =
    accent === 'green'
      ? isDarkMode ? 'bg-green-500/15 text-green-400' : 'bg-green-100 text-green-700'
      : isDarkMode ? 'bg-amber-500/15 text-amber-400' : 'bg-amber-100 text-amber-600';

  return (
    <div
      className={`flex flex-col h-full rounded-xl border p-3.5 ${
        isActive ? `${activeBg} ${activeBorder}` : `${inactiveBg} ${inactiveBorder}`
      }`}
    >
      {/* Row 1: tier label + YOU badge */}
      <div className="flex items-center justify-between mb-3">
        <span
          className={`text-xs font-semibold uppercase tracking-wider ${
            isActive ? accentText : isDarkMode ? 'text-gray-500' : 'text-gray-400'
          }`}
        >
          {label}
        </span>
        {isActive ? (
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded leading-none ${accentBadge}`}>
            YOU
          </span>
        ) : (
          // Invisible placeholder so header row height is consistent
          <span className="text-[10px] px-1.5 py-0.5 opacity-0 leading-none">YOU</span>
        )}
      </div>

      {/* Row 2: main pts number */}
      <div
        className={`text-2xl font-bold tabular-nums leading-none ${
          isActive ? accentText : isDarkMode ? 'text-white' : 'text-gray-900'
        }`}
      >
        {ptsDisplay}
      </div>
      <div className={`text-[11px] mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
        {ptsLabel}
      </div>

      {/* Divider */}
      <div className={`my-3 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`} />

      {/* Row 3 & 4: two info rows — always rendered to lock card height */}
      <div className="space-y-1.5">
        {rows.map(({ label: rl, value: rv }, i) => (
          <div key={i} className="flex items-center justify-between min-h-[18px]">
            <span className={`text-[10px] ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>{rl}</span>
            <span className={`text-[10px] font-medium tabular-nums ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              {rv}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ClaimPage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isDarkMode } = useTheme();
  const { data: session } = useSession();
  const { address } = useAccount();

  const walletAddress = address || session?.address || '';
  const isWalletConnected = !!(address && session?.address && address.toLowerCase() === session.address.toLowerCase());
  const { openConnectModal } = useConnectModal();
  const { ethPrice } = useInkEthPrice();

  const { user, loading: userLoading, error: claimError, refreshUserData } = usePoints();

  const {
    canClaim,
    secondsUntilClaim,
    isClaimPending,
    isClaimConfirming,
    executeClaim,
    stakerTierCost,
    holderTierCost,
    regularTierCost,
    pointsPerDailyStakedNFT,
    pointsPerWeeklyStakedNFT,
    pointsPerMonthlyStakedNFT,
    pointsPerAvailableNFT,
    pointsPerHeldNFT,
    pointsPerStakedNFT,
    pointsForRegularUser,
    rewardPerRegularUser,
    stakerTierCooldown,
    holderTierCooldown,
    regularTierCooldown,
    canClaimWithFeesStaker,
    secondsUntilStaker,
    canClaimWithFeesHolder,
    secondsUntilHolder,
    canClaimWithFeesRegular,
    secondsUntilRegular,
    executeClaimWithFeesStaker,
    executeClaimWithFeesHolder,
    executeClaimWithFeesRegular,
    isClaimWithFeesPending,
    isClaimWithFeesConfirming,
    isClaimWithFeesSuccess,
    isClaimSuccess,
    refreshClaimStatus,
    userCategory,
    totalSupply,
    maxSupply,
    maxSupplySet,
  } = useClaiming();

  // Refresh context balance after successful paid or free claim on this page
  useEffect(() => {
    if (isClaimWithFeesSuccess || isClaimSuccess) {
      refreshUserData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClaimWithFeesSuccess, isClaimSuccess]);

  const { nftCount, stakingBreakdown } = useNftAndStaking();
  // Display category derived from local NFT/staking reads (used for tier card visuals + daily pts).
  const displayCategory = getUserCategory(nftCount, stakingBreakdown.total);
  // Active paid tier MUST match what the contract will charge in claimWithFees(),
  // which is determined on-chain by getUserCategory(msg.sender). Using the local
  // derived category can desync (RPC lag, multi-RPC fallback) and cause
  // "Insufficient fee" reverts after the user signs the tx. Prefer on-chain.
  // userCategory: 2=STAKER, 1=HOLDER, 0=REGULAR
  const category =
    userCategory === 2 ? 'staker' as const
    : userCategory === 1 ? 'holder' as const
    : userCategory === 0 ? 'regular' as const
    : displayCategory; // fallback while on-chain read pending

  // Live countdown for the free claim cooldown
  const [liveFreeCountdown, setLiveFreeCountdown] = useState<number>(secondsUntilClaim);

  useEffect(() => {
    setLiveFreeCountdown(secondsUntilClaim);
  }, [secondsUntilClaim]);

  useEffect(() => {
    if (liveFreeCountdown <= 0) return;
    const id = setInterval(() => setLiveFreeCountdown(prev => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(id);
  }, [liveFreeCountdown]);

  // When the free countdown reaches 0, refetch on-chain state so canClaim
  // re-evaluates with fresh data. Without this, a 1-second rounding difference
  // between the JS timer and the block timestamp can leave the button disabled
  // indefinitely once the interval stops.
  useEffect(() => {
    if (liveFreeCountdown === 0) {
      refreshClaimStatus();
    }
  }, [liveFreeCountdown, refreshClaimStatus]);

  // Live countdown for the user's active paid tier cooldown
  const activeTierSecs =
    category === 'staker' ? secondsUntilStaker
    : category === 'holder' ? secondsUntilHolder
    : secondsUntilRegular;

  const [liveCountdown, setLiveCountdown] = useState<number>(activeTierSecs);
  const [holdersCount, setHoldersCount] = useState<number | null>(null);
  const [totalBurned, setTotalBurned] = useState<bigint | null>(null);
  const [totalBurnedLoading, setTotalBurnedLoading] = useState(false);

  useEffect(() => {
    setLiveCountdown(activeTierSecs);
  }, [activeTierSecs]);

  useEffect(() => {
    if (liveCountdown <= 0) return;
    const id = setInterval(() => setLiveCountdown(prev => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(id);
  }, [liveCountdown]);

  useEffect(() => {
    if (liveCountdown === 0) {
      refreshClaimStatus();
    }
  }, [liveCountdown, refreshClaimStatus]);

  useEffect(() => {
    let alive = true;

    const loadHoldersCount = async () => {
      try {
        const response = await fetch('/api/leaderboard/points-stats');
        if (!response.ok) {
          throw new Error(`Failed to load holders count: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        if (alive) {
          const nextCount = Number.parseInt(String(data.tokenHoldersCount ?? 0), 10);
          setHoldersCount(Number.isFinite(nextCount) ? nextCount : 0);
        }
      } catch {
        if (alive) {
          setHoldersCount(null);
        }
      }
    };

    loadHoldersCount();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!SHELLIES_POINTS_ADDRESS || SHELLIES_POINTS_ADDRESS === '0x') return;

    let alive = true;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), BURNED_POINTS_FETCH_TIMEOUT_MS);
    const cached = readCachedBurnedPoints(SHELLIES_POINTS_ADDRESS);

    if (cached) {
      setTotalBurned(cached.value);
    }

    if (cached && Date.now() - cached.updatedAt < BURNED_POINTS_FRESH_MS) {
      clearTimeout(timeoutId);
      return () => {
        alive = false;
        controller.abort();
      };
    }

    setTotalBurnedLoading(!cached);

    const loadTotalBurned = async () => {
      try {
        const nextTotalBurned = await fetchTotalBurnedFromExplorer(
          SHELLIES_POINTS_ADDRESS,
          controller.signal
        );

        if (!alive) return;

        writeCachedBurnedPoints(SHELLIES_POINTS_ADDRESS, nextTotalBurned);
        setTotalBurned(nextTotalBurned);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.warn('Unable to load ShelliesPoints burned total:', error);
      } finally {
        clearTimeout(timeoutId);
        if (alive) {
          setTotalBurnedLoading(false);
        }
      }
    };

    loadTotalBurned();

    return () => {
      alive = false;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, []);

  // ── Daily tier data ──────────────────────────────────────────────────────
  const stakerDailyPts =
    stakingBreakdown.day * pointsPerDailyStakedNFT +
    stakingBreakdown.week * pointsPerWeeklyStakedNFT +
    stakingBreakdown.month * pointsPerMonthlyStakedNFT;

  const dailyTierCards = [
    {
      key: 'staker',
      label: 'Stakers',
      pts: stakerDailyPts,
      ptsLabel: 'pts / day',
      rows: [
        {
          label: 'D / W / Y',
          value: `×${pointsPerDailyStakedNFT} · ×${pointsPerWeeklyStakedNFT} · ×${pointsPerMonthlyStakedNFT}`,
        },
        {
          label: 'Staked',
          value: `${stakingBreakdown.total} NFT${stakingBreakdown.total !== 1 ? 's' : ''}`,
        },
      ] as [TierRow, TierRow],
      active: category === 'staker',
    },
    {
      key: 'holder',
      label: 'Holders',
      pts: nftCount * pointsPerAvailableNFT,
      ptsLabel: 'pts / day',
      rows: [
        { label: 'Rate', value: `×${pointsPerAvailableNFT} / NFT` },
        { label: 'Held', value: `${nftCount} NFT${nftCount !== 1 ? 's' : ''}` },
      ] as [TierRow, TierRow],
      active: category === 'holder',
    },
    {
      key: 'regular',
      label: 'Regular',
      pts: pointsForRegularUser,
      ptsLabel: 'pts / day',
      rows: [
        { label: 'Rate', value: 'Flat daily' },
        { label: '', value: '' },
      ] as [TierRow, TierRow],
      active: category === 'regular',
    },
  ];

  // ── Instant (paid) tier data ──────────────────────────────────────────────
  const paidTierCards = [
    {
      key: 'staker',
      label: 'Stakers',
      pts: pointsPerStakedNFT,
      cost: stakerTierCost,
      cooldown: stakerTierCooldown,
      secs: secondsUntilStaker,
      can: canClaimWithFeesStaker,
      fn: executeClaimWithFeesStaker,
      active: category === 'staker',
    },
    {
      key: 'holder',
      label: 'Holders',
      pts: pointsPerHeldNFT,
      cost: holderTierCost,
      cooldown: holderTierCooldown,
      secs: secondsUntilHolder,
      can: canClaimWithFeesHolder,
      fn: executeClaimWithFeesHolder,
      active: category === 'holder',
    },
    {
      key: 'regular',
      label: 'Regular',
      pts: rewardPerRegularUser,
      cost: regularTierCost,
      cooldown: regularTierCooldown,
      secs: secondsUntilRegular,
      can: canClaimWithFeesRegular,
      fn: executeClaimWithFeesRegular,
      active: category === 'regular',
    },
  ];

  const activePaidTier = paidTierCards.find(t => t.active);
  const anyPaidPending = isClaimWithFeesPending || isClaimWithFeesConfirming;

  return (
    <div className={`min-h-screen flex transition-colors duration-300 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <PortalSidebar isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />

      <div className="flex-1 flex flex-col lg:ml-4 min-h-screen">
        <main className="flex-1 p-3 sm:p-4 lg:p-6 mt-16 lg:mt-0 mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 xl:px-16 2xl:px-32">
          <div className="space-y-6">

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className={`text-xl sm:text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Claim
                </h1>
                <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Daily rewards, instant points, and XP conversion
                </p>
              </div>
              <div className={`px-3 py-1 rounded-full border text-xs font-medium ${isDarkMode ? 'bg-gray-800 border-gray-600 text-gray-300' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'Not connected'}
              </div>
            </div>

            {isWalletConnected && userLoading ? (
              <ClaimPageSkeleton isDarkMode={isDarkMode} />
            ) : (
              <>

            <SupplyProgressCard
              totalSupply={totalSupply}
              maxSupply={maxSupply}
              maxSupplySet={maxSupplySet}
              holdersCount={holdersCount}
              totalBurned={totalBurned}
              totalBurnedLoading={totalBurnedLoading}
              isDarkMode={isDarkMode}
            />

            {/* Two claim panels side by side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">

              {/* ── Daily Rewards ── */}
              <div className={`rounded-2xl border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                <div className="p-5 flex flex-col gap-4 h-full">

                  {/* Panel header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={`p-2 rounded-xl ${isDarkMode ? 'bg-green-500/20' : 'bg-green-100'}`}>
                        <Gift className="w-4 h-4 text-green-600" />
                      </div>
                      <div>
                        <h2 className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          Daily Rewards
                        </h2>
                        <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                          Free claim — no ETH required
                        </p>
                      </div>
                    </div>
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                      isWalletConnected && canClaim
                        ? isDarkMode ? 'bg-green-500/20 text-green-400' : 'bg-green-50 text-green-700'
                        : isDarkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'
                    }`}>
                      <span className={`inline-block w-1.5 h-1.5 rounded-full ${isWalletConnected && canClaim ? 'bg-green-500' : 'bg-gray-400'}`} />
                      {!isWalletConnected ? '—' : canClaim ? 'Ready' : 'Cooldown'}
                    </div>
                  </div>

                  {/* Tier cards */}
                  <div className="grid grid-cols-3 gap-3 items-stretch">
                    {dailyTierCards.map(({ key, label, pts, ptsLabel, rows, active }) => (
                      <TierCard
                        key={key}
                        label={label}
                        isActive={active && isWalletConnected}
                        pts={pts}
                        ptsLabel={ptsLabel}
                        rows={rows}
                        accent="green"
                        isDarkMode={isDarkMode}
                      />
                    ))}
                  </div>

                  {/* Push action to bottom */}
                  <div className="flex-1" />

                  {/* Action */}
                  <button
                    onClick={() => isWalletConnected ? executeClaim() : openConnectModal?.()}
                    disabled={isWalletConnected && (!canClaim || isClaimPending || isClaimConfirming)}
                    className={`w-full py-3 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
                      isWalletConnected && (!canClaim || isClaimPending || isClaimConfirming)
                        ? isDarkMode ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-gray-100 text-gray-500 cursor-not-allowed'
                        : 'bg-green-600 hover:bg-green-700 text-white'
                    }`}
                  >
                    {!isWalletConnected ? (
                      'Connect Wallet'
                    ) : isClaimPending ? (
                      'Confirm in wallet...'
                    ) : isClaimConfirming ? (
                      'Claiming...'
                    ) : liveFreeCountdown > 0 ? (
                      <>
                        <span>Next claim in</span>
                        <span className="font-mono tabular-nums">{formatTimer(liveFreeCountdown)}</span>
                      </>
                    ) : (
                      'Claim Free Points'
                    )}
                  </button>
                </div>
              </div>

              {/* ── Instant Points ── */}
              <div className={`rounded-2xl border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                <div className="p-5 flex flex-col gap-4 h-full">

                  {/* Panel header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={`p-2 rounded-xl ${isDarkMode ? 'bg-amber-500/20' : 'bg-amber-100'}`}>
                        <Zap className="w-4 h-4 text-amber-500" />
                      </div>
                      <div>
                        <h2 className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          Instant Points
                        </h2>
                        <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                          Buy points with ETH
                        </p>
                      </div>
                    </div>
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                      isWalletConnected && activePaidTier?.can
                        ? isDarkMode ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-50 text-amber-700'
                        : isDarkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'
                    }`}>
                      <span className={`inline-block w-1.5 h-1.5 rounded-full ${isWalletConnected && activePaidTier?.can ? 'bg-amber-500' : 'bg-gray-400'}`} />
                      {!isWalletConnected ? '—' : activePaidTier?.can ? 'Ready' : 'Cooldown'}
                    </div>
                  </div>

                  {/* Tier cards */}
                  <div className="grid grid-cols-3 gap-3 items-stretch">
                    {paidTierCards.map(({ key, label, pts, cost, cooldown, active }) => (
                      <TierCard
                        key={key}
                        label={label}
                        isActive={active && isWalletConnected}
                        pts={pts}
                        ptsLabel="pts instant"
                        rows={[
                          { label: 'Cost', value: cost === BigInt(0) ? 'FREE' : formatUsdEth(cost, ethPrice) },
                          { label: 'Cooldown', value: cooldown > 0 ? formatTimer(cooldown) : 'None' },
                        ]}
                        accent="amber"
                        isDarkMode={isDarkMode}
                      />
                    ))}
                  </div>

                  {/* Push action to bottom */}
                  <div className="flex-1" />

                  {/* Action */}
                  <button
                    onClick={() => isWalletConnected ? activePaidTier?.fn?.() : openConnectModal?.()}
                    disabled={isWalletConnected && (anyPaidPending || !activePaidTier?.can)}
                    className={`w-full py-3 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
                      isWalletConnected && (anyPaidPending || !activePaidTier?.can)
                        ? isDarkMode ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-gray-100 text-gray-500 cursor-not-allowed'
                        : 'bg-amber-500 hover:bg-amber-600 text-white'
                    }`}
                  >
                    {!isWalletConnected ? (
                      'Connect Wallet'
                    ) : isClaimWithFeesPending ? (
                      'Confirm in wallet...'
                    ) : isClaimWithFeesConfirming ? (
                      'Processing...'
                    ) : liveCountdown > 0 ? (
                      <>
                        <span>Next claim in</span>
                        <span className="font-mono tabular-nums">{formatTimer(liveCountdown)}</span>
                      </>
                    ) : (
                      'Buy Points'
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* XP Converter */}
            {user ? (
              <XPBridge
                currentXP={user.game_score || 0}
                currentPoints={user.points || 0}
                onConversionComplete={() => {
                  refreshUserData();
                  refreshClaimStatus();
                }}
              />
            ) : (
              <div className={`rounded-2xl border p-8 text-center ${isDarkMode ? 'bg-gray-800 border-gray-700 text-gray-400' : 'bg-white border-gray-200 text-gray-500'}`}>
                <p className="text-sm">Connect your wallet to convert XP</p>
              </div>
            )}

            {claimError && (
              <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-red-900/20 border-red-800 text-red-300' : 'bg-red-50 border-red-200 text-red-700'}`}>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                  <p className="text-xs font-medium">{claimError}</p>
                </div>
              </div>
            )}

            </>
          )}
          </div>
        </main>
      </div>
    </div>
  );
}
