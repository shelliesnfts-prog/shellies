'use client';

import { useEffect, useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Lock, TrendingUp, Star, Wallet, Clock, Calendar, CalendarDays } from 'lucide-react';
import { StakingService, LockPeriod } from '@/lib/staking-service';

interface StakingPublicPreviewProps {
  isDarkMode: boolean;
}

interface GlobalStats {
  totalNFTsStaked: number;
  totalStakers: number;
  tokenHoldersCount: number;
}

const TOTAL_NFT_SUPPLY = 2222;

const LOCK_TIERS: Array<{
  period: LockPeriod;
  label: string;
  duration: string;
  points: number;
  accent: 'blue' | 'purple' | 'green';
  icon: typeof Clock;
}> = [
  { period: LockPeriod.DAY, label: '1 Day', duration: '24 hours', points: 7, accent: 'blue', icon: Clock },
  { period: LockPeriod.WEEK, label: '1 Week', duration: '7 days', points: 10, accent: 'purple', icon: Calendar },
  { period: LockPeriod.MONTH, label: '1 Month', duration: '30 days', points: 20, accent: 'green', icon: CalendarDays },
];

export function StakingPublicPreview({ isDarkMode }: StakingPublicPreviewProps) {
  const [stats, setStats] = useState<GlobalStats>({
    totalNFTsStaked: 0,
    totalStakers: 0,
    tokenHoldersCount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const result = await StakingService.getGlobalStakingStats();
        if (!cancelled) setStats(result);
      } catch (error) {
        console.error('Failed to load public staking stats:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const stakedPercent = stats.totalNFTsStaked > 0
    ? ((stats.totalNFTsStaked / TOTAL_NFT_SUPPLY) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="space-y-6">
      {/* Page Header — mirrors connected staking page */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            NFT Staking
          </h1>
          <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Stake your Shellies NFTs to earn up to{' '}
            <span className="font-semibold text-blue-600">20 points per day</span> per NFT
          </p>
        </div>
        <div
          className={`px-4 py-2 rounded-xl border ${
            isDarkMode
              ? 'bg-gray-800/50 border-gray-600 text-gray-300 backdrop-blur-sm'
              : 'bg-white/60 border-gray-200 text-gray-600 backdrop-blur-sm shadow-sm'
          }`}
        >
          <span className="text-sm font-medium">
            {loading ? '...' : `${stats.totalNFTsStaked} / ${TOTAL_NFT_SUPPLY} Staked`}
          </span>
        </div>
      </div>

      {/* Global Stats — same card pattern as connected page */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Total Staked */}
        <div
          className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${
            isDarkMode
              ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 hover:border-blue-500'
              : 'bg-gradient-to-br from-white to-blue-50/30 border-blue-200/60 hover:border-blue-300 shadow-sm'
          }`}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="relative p-5">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-2.5 rounded-xl ${isDarkMode ? 'bg-blue-500/20' : 'bg-blue-100'}`}>
                <Lock className="w-5 h-5 text-blue-600" />
              </div>
              <div
                className={`text-xs font-medium px-2 py-1 rounded-full ${
                  isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-blue-50 text-blue-700'
                }`}
              >
                Locked
              </div>
            </div>
            <div className="space-y-1">
              <h3 className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Total NFTs Staked
              </h3>
              {loading ? (
                <div className={`h-9 rounded animate-pulse w-20 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'}`} />
              ) : (
                <div className="flex items-baseline gap-2">
                  <p className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {stats.totalNFTsStaked}
                  </p>
                  <p className={`text-sm font-semibold ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                    {stakedPercent}%
                  </p>
                </div>
              )}
              <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                Of {TOTAL_NFT_SUPPLY.toLocaleString()} total supply
              </p>
            </div>
          </div>
        </div>

        {/* Active Stakers */}
        <div
          className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${
            isDarkMode
              ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 hover:border-purple-500'
              : 'bg-gradient-to-br from-white to-purple-50/30 border-purple-200/60 hover:border-purple-300 shadow-sm'
          }`}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="relative p-5">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-2.5 rounded-xl ${isDarkMode ? 'bg-purple-500/20' : 'bg-purple-100'}`}>
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
              <div
                className={`text-xs font-medium px-2 py-1 rounded-full ${
                  isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-purple-50 text-purple-700'
                }`}
              >
                Stakers
              </div>
            </div>
            <div className="space-y-1">
              <h3 className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Active Stakers
              </h3>
              {loading ? (
                <div className={`h-9 rounded animate-pulse w-16 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'}`} />
              ) : (
                <p className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {stats.totalStakers}
                </p>
              )}
              <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                Earning points right now
              </p>
            </div>
          </div>
        </div>

        {/* Holders */}
        <div
          className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${
            isDarkMode
              ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 hover:border-green-500'
              : 'bg-gradient-to-br from-white to-green-50/30 border-green-200/60 hover:border-green-300 shadow-sm'
          }`}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="relative p-5">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-2.5 rounded-xl ${isDarkMode ? 'bg-green-500/20' : 'bg-green-100'}`}>
                <Star className="w-5 h-5 text-green-600" />
              </div>
              <div
                className={`text-xs font-medium px-2 py-1 rounded-full ${
                  isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-green-50 text-green-700'
                }`}
              >
                Holders
              </div>
            </div>
            <div className="space-y-1">
              <h3 className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Shellies Holders
              </h3>
              {loading ? (
                <div className={`h-9 rounded animate-pulse w-16 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'}`} />
              ) : (
                <p className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {stats.tokenHoldersCount}
                </p>
              )}
              <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                In the community
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Connect prompt + Lock period tiers */}
      <div
        className={`rounded-2xl border ${
          isDarkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
        }`}
      >
        {/* Connect bar */}
        <div
          className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-5 border-b ${
            isDarkMode ? 'border-gray-700' : 'border-gray-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                isDarkMode ? 'bg-purple-500/15' : 'bg-purple-100'
              }`}
            >
              <Wallet className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3 className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Connect your wallet to stake
              </h3>
              <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Non-custodial. We never store private keys.
              </p>
            </div>
          </div>
          <ConnectButton />
        </div>

        {/* Lock tier section */}
        <div className="p-5 space-y-4">
          <div>
            <h3 className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Lock Periods
            </h3>
            <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Pick a lock duration when you stake. Longer locks earn more daily points per NFT.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {LOCK_TIERS.map((tier) => (
              <TierCard key={tier.label} tier={tier} isDarkMode={isDarkMode} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TierCard({
  tier,
  isDarkMode,
}: {
  tier: (typeof LOCK_TIERS)[number];
  isDarkMode: boolean;
}) {
  const Icon = tier.icon;

  const accentText =
    tier.accent === 'blue'
      ? isDarkMode ? 'text-blue-400' : 'text-blue-600'
      : tier.accent === 'purple'
      ? isDarkMode ? 'text-purple-400' : 'text-purple-600'
      : isDarkMode ? 'text-green-400' : 'text-green-600';

  const accentBorder =
    tier.accent === 'blue'
      ? isDarkMode ? 'border-blue-500/40' : 'border-blue-200'
      : tier.accent === 'purple'
      ? isDarkMode ? 'border-purple-500/40' : 'border-purple-200'
      : isDarkMode ? 'border-green-500/40' : 'border-green-200';

  const accentBadge =
    tier.accent === 'blue'
      ? isDarkMode ? 'bg-blue-500/15 text-blue-400' : 'bg-blue-50 text-blue-700'
      : tier.accent === 'purple'
      ? isDarkMode ? 'bg-purple-500/15 text-purple-400' : 'bg-purple-50 text-purple-700'
      : isDarkMode ? 'bg-green-500/15 text-green-400' : 'bg-green-50 text-green-700';

  return (
    <div
      className={`flex flex-col h-full rounded-xl border p-4 ${
        isDarkMode ? `bg-gray-800 ${accentBorder}` : `bg-white ${accentBorder}`
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${accentText}`} />
          <span className={`text-xs font-semibold uppercase tracking-wider ${accentText}`}>
            {tier.label}
          </span>
        </div>
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded leading-none ${accentBadge}`}>
          {tier.duration}
        </span>
      </div>

      <div className={`text-2xl font-bold tabular-nums leading-none ${accentText}`}>
        {tier.points}
      </div>
      <div className={`text-[11px] mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
        pts / day per NFT
      </div>

      <div className={`my-3 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`} />

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className={`text-[10px] ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            Lock duration
          </span>
          <span className={`text-[10px] font-medium tabular-nums ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            {tier.duration}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className={`text-[10px] ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            Total over lock
          </span>
          <span className={`text-[10px] font-medium tabular-nums ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            {tier.period === LockPeriod.DAY
              ? `${tier.points}`
              : tier.period === LockPeriod.WEEK
              ? `${tier.points * 7}`
              : `${tier.points * 30}`}{' '}
            pts
          </span>
        </div>
      </div>
    </div>
  );
}
