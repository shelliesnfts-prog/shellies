'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useAccount } from 'wagmi';
import { PortalSidebar } from '@/components/portal/PortalSidebar';
import { WalletRequired } from '@/components/portal/WalletRequired';
import { usePoints } from '@/contexts/PointsContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ProfilePageSkeleton } from '@/components/portal/ProfilePageSkeleton';
import { useNftAndStaking } from '@/hooks/useNftAndStaking';
import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation';
import { Trophy, ArrowRight, Sparkles, Target, Clock, Calendar, CalendarDays, ExternalLink, Layers } from 'lucide-react';

function formatTimer(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function ProfilePage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isDarkMode } = useTheme();
  const { data: session } = useSession();
  const { address } = useAccount();
  const router = useRouter();
  const pathname = usePathname();

  const walletAddress = address || session?.address || '';
  const isWalletConnected = !!(address && session?.address && address.toLowerCase() === session.address.toLowerCase());

  const { user, loading: userLoading, refreshUserData, refreshWithFreshData } = usePoints();
  const { nftCount, stakingBreakdown, loading: loadingNftAndStaking } = useNftAndStaking();

  const { claimStatus, claiming, error: claimError } = usePoints();

  const canClaim = claimStatus?.canClaim ?? false;
  const secondsUntilClaim = claimStatus?.secondsUntilNextClaim ?? 0;

  useEffect(() => {
    if (pathname === '/portal/profile' && walletAddress) {
      refreshUserData();
    }
  }, [pathname, walletAddress]);

  const handleOpenNFTCollection = () => {
    const explorerUrl = 'https://www.netprotocol.app/app/bazaar/ink/0x1c9838cdC00fA39d953a54c755b95605Ed5Ea49c?tab=listings&s=09';
    window.open(explorerUrl, '_blank', 'noopener,noreferrer');
  };

  const handleNavigateToStaking = () => {
    router.push('/portal/staking');
  };


  return (
    <div className={`min-h-screen flex transition-colors duration-300 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <PortalSidebar
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:ml-4 min-h-screen">
        <main className="flex-1 p-3 sm:p-4 lg:p-6 mt-16 lg:mt-0 mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 xl:px-16 2xl:px-32">
          {!isWalletConnected ? (
            <div className="space-y-6">
              {/* Header Section — always visible */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className={`text-xl sm:text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Profile Overview
                  </h1>
                  <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Track your NFTs, points, and daily rewards
                  </p>
                </div>
              </div>
              <WalletRequired
                variant="card"
                isDarkMode={isDarkMode}
                title="Connect your wallet"
                action="connect to view your profile"
              />
            </div>
          ) : userLoading ? (
            <ProfilePageSkeleton isDarkMode={isDarkMode} />
          ) : (
            <div className="space-y-6">
              {/* Header Section */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className={`text-xl sm:text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Profile Overview
                  </h1>
                  <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Track your NFTs, points, and daily rewards
                  </p>
                </div>
                <div className={`px-3 py-1 rounded-full border ${isDarkMode
                  ? 'bg-gray-800 border-gray-600 text-gray-300'
                  : 'bg-gray-50 border-gray-200 text-gray-600'
                  }`}>
                  <span className="text-xs font-medium">
                    {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'Not connected'}
                  </span>
                </div>
              </div>
              {/* Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                {/* NFT Holdings Card */}
                <div className={`h-fit group relative overflow-hidden rounded-2xl border transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${isDarkMode
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 hover:border-purple-500'
                  : 'bg-gradient-to-br from-white to-gray-50 border-gray-200 hover:border-purple-300'
                  }`}>
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="relative p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className={`p-2.5 rounded-xl ${isDarkMode ? 'bg-purple-500/20' : 'bg-purple-100'
                        }`}>
                        <Trophy className="w-5 h-5 text-purple-600" />
                      </div>
                      <div className={`text-xs font-medium px-2 py-1 rounded-full ${isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
                        }`}>Live</div>
                    </div>
                    <div className="space-y-1">
                      <h3 className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        NFT Holdings
                      </h3>
                      {loadingNftAndStaking ? (
                        <div className={`h-8 rounded animate-pulse w-12 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'}`}></div>
                      ) : (
                        <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {nftCount}
                        </p>
                      )}
                      <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>Shellies NFTs</p>
                    </div>
                  </div>
                </div>

                {/* 1 Day Staked NFTs */}
                <div className={`h-fit group relative overflow-hidden rounded-2xl border transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${isDarkMode
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 hover:border-yellow-500'
                  : 'bg-gradient-to-br from-white to-yellow-50/30 border-yellow-200/60 hover:border-yellow-300'
                  }`}>
                  <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="relative p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className={`p-2.5 rounded-xl ${isDarkMode ? 'bg-yellow-500/20' : 'bg-yellow-100'
                        }`}>
                        <Clock className="w-5 h-5 text-yellow-600" />
                      </div>
                      <div className={`text-xs font-medium px-2 py-1 rounded-full ${isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-yellow-50 text-yellow-700'
                        }`}>1 Day</div>
                    </div>
                    <div className="space-y-1">
                      <h3 className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Day Lock
                      </h3>
                      {loadingNftAndStaking ? (
                        <div className={`h-8 rounded animate-pulse w-16 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'}`}></div>
                      ) : (
                        <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {stakingBreakdown.day}
                        </p>
                      )}
                      <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                        NFT{stakingBreakdown.day !== 1 ? 's' : ''} staked
                      </p>
                    </div>
                  </div>
                </div>

                {/* 1 Week Staked NFTs */}
                <div className={`h-fit group relative overflow-hidden rounded-2xl border transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${isDarkMode
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 hover:border-blue-500'
                  : 'bg-gradient-to-br from-white to-blue-50/30 border-blue-200/60 hover:border-blue-300'
                  }`}>
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="relative p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className={`p-2.5 rounded-xl ${isDarkMode ? 'bg-blue-500/20' : 'bg-blue-100'
                        }`}>
                        <Calendar className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className={`text-xs font-medium px-2 py-1 rounded-full ${isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-blue-50 text-blue-700'
                        }`}>1 Week</div>
                    </div>
                    <div className="space-y-1">
                      <h3 className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Week Lock
                      </h3>
                      {loadingNftAndStaking ? (
                        <div className={`h-8 rounded animate-pulse w-16 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'}`}></div>
                      ) : (
                        <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {stakingBreakdown.week}
                        </p>
                      )}
                      <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                        NFT{stakingBreakdown.week !== 1 ? 's' : ''} staked
                      </p>
                    </div>
                  </div>
                </div>

                {/* 1 Month Staked NFTs */}
                <div className={`h-fit group relative overflow-hidden rounded-2xl border transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${isDarkMode
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 hover:border-green-500'
                  : 'bg-gradient-to-br from-white to-green-50/30 border-green-200/60 hover:border-green-300'
                  }`}>
                  <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="relative p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className={`p-2.5 rounded-xl ${isDarkMode ? 'bg-green-500/20' : 'bg-green-100'
                        }`}>
                        <CalendarDays className="w-5 h-5 text-green-600" />
                      </div>
                      <div className={`text-xs font-medium px-2 py-1 rounded-full ${isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-green-50 text-green-700'
                        }`}>1 Month</div>
                    </div>
                    <div className="space-y-1">
                      <h3 className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Month Lock
                      </h3>
                      {loadingNftAndStaking ? (
                        <div className={`h-8 rounded animate-pulse w-16 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'}`}></div>
                      ) : (
                        <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {stakingBreakdown.month}
                        </p>
                      )}
                      <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                        NFT{stakingBreakdown.month !== 1 ? 's' : ''} staked
                      </p>
                    </div>
                  </div>
                </div>

              </div>

              {/* Navigation Actions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                {/* Staking Page Link */}
                <div
                  onClick={handleNavigateToStaking}
                  className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 hover:shadow-xl hover:-translate-y-2 cursor-pointer ${isDarkMode
                    ? 'bg-gradient-to-br from-blue-900/40 to-blue-800/40 border-blue-700/50 hover:border-blue-500'
                    : 'bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200 hover:border-blue-400'
                    }`}>
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-400/20 to-transparent rounded-full -translate-y-16 translate-x-16 group-hover:scale-150 transition-transform duration-500" />
                  <div className="relative p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className={`p-3 rounded-xl ${isDarkMode ? 'bg-blue-500/20' : 'bg-blue-200/60'
                        } group-hover:scale-110 transition-transform duration-300`}>
                        <Layers className="w-6 h-6 text-blue-600" />
                      </div>
                      <ArrowRight className={`w-5 h-5 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}
                        group-hover:translate-x-1 transition-transform duration-300`} />
                    </div>
                    <div className="space-y-2">
                      <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        Start Staking
                      </h3>
                      <p className={`text-sm ${isDarkMode ? 'text-blue-300' : 'text-blue-700'}`}>
                        Stake your NFTs and earn up to 20x rewards! Lock your Shellies for higher multipliers.
                      </p>
                      <div className={`inline-flex items-center space-x-1 text-xs font-medium px-3 py-1 rounded-full ${isDarkMode
                        ? 'bg-blue-500/20 text-blue-300'
                        : 'bg-blue-200/60 text-blue-700'
                        }`}>
                        <Sparkles className="w-3 h-3" />
                        <span>Boost Your Earnings</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* NFT Explorer Link */}
                <div
                  onClick={handleOpenNFTCollection}
                  className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 hover:shadow-xl hover:-translate-y-2 cursor-pointer ${isDarkMode
                    ? 'bg-gradient-to-br from-purple-900/40 to-pink-800/40 border-purple-700/50 hover:border-purple-500'
                    : 'bg-gradient-to-br from-purple-50 to-pink-100/50 border-purple-200 hover:border-purple-400'
                    }`}>
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-400/20 to-transparent rounded-full -translate-y-16 translate-x-16 group-hover:scale-150 transition-transform duration-500" />
                  <div className="relative p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className={`p-3 rounded-xl ${isDarkMode ? 'bg-purple-500/20' : 'bg-purple-200/60'
                        } group-hover:scale-110 transition-transform duration-300`}>
                        <ExternalLink className="w-6 h-6 text-purple-600" />
                      </div>
                      <ArrowRight className={`w-5 h-5 ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}
                        group-hover:translate-x-1 transition-transform duration-300`} />
                    </div>
                    <div className="space-y-2">
                      <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        Explore Collection
                      </h3>
                      <p className={`text-sm ${isDarkMode ? 'text-purple-300' : 'text-purple-700'}`}>
                        View the complete Shellies NFT collection on Ink blockchain explorer and track activity.
                      </p>
                      <div className={`inline-flex items-center space-x-1 text-xs font-medium px-3 py-1 rounded-full ${isDarkMode
                        ? 'bg-purple-500/20 text-purple-300'
                        : 'bg-purple-200/60 text-purple-700'
                        }`}>
                        <Target className="w-3 h-3" />
                        <span>View on Explorer</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Error Display */}
              {claimError && (
                <div className={`p-4 rounded-xl border ${isDarkMode
                  ? 'bg-red-900/20 border-red-800 text-red-300'
                  : 'bg-red-50 border-red-200 text-red-700'
                  }`}>
                  <div className="flex items-center space-x-2">
                    <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                    <p className="text-xs font-medium">⚠️ {claimError}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}