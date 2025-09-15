'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useAccount } from 'wagmi';
import { PortalSidebar } from '@/components/portal/PortalSidebar';
import { ClaimButtonWithCountdown } from '@/components/ClaimCountdown';
import { usePoints } from '@/contexts/PointsContext';
import { useTheme } from '@/contexts/ThemeContext';
import { NFTService, SHELLIES_CONTRACT_ADDRESS } from '@/lib/nft-service';
import { StakingService } from '@/lib/staking-service';
import { ProfilePageSkeleton } from '@/components/portal/ProfilePageSkeleton';
import { useRouter } from 'next/navigation';
import { Trophy, Coins, Gift, TrendingUp, ArrowRight, Sparkles, Target, Zap, Clock, Calendar, CalendarDays } from 'lucide-react';

export default function ProfilePage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [stakingBreakdown, setStakingBreakdown] = useState({
    day: 0,
    week: 0,
    month: 0,
    total: 0
  });
  const [loadingStaking, setLoadingStaking] = useState(false);

  const { isDarkMode } = useTheme();
  const { data: session } = useSession();
  const { address } = useAccount();
  const router = useRouter();
  const { user, claimStatus, loading: userLoading, claiming, executeUnifiedClaim, error: claimError, refreshUserData, refreshWithFreshData } = usePoints();

  const walletAddress = address || session?.address || '';

  // Get tier information for motivational display
  const nftCount = claimStatus?.nftCount ?? 0;
  const tierInfo = NFTService.getUserTierInfo(nftCount);

  const handleClaimUnified = async () => {
    await executeUnifiedClaim();
  };


  const handleOpenNFTCollection = () => {
    if (SHELLIES_CONTRACT_ADDRESS) {
      // Open Shellies NFT collection in Ink blockchain explorer in a new tab
      const explorerUrl = `https://explorer.inkonchain.com/address/${SHELLIES_CONTRACT_ADDRESS}`;
      window.open(explorerUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleNavigateToStaking = () => {
    router.push('/portal/staking');
  };

  // Force fresh data when profile page is visited
  useEffect(() => {
    if (walletAddress) {
      refreshWithFreshData();
    }
  }, [refreshWithFreshData, walletAddress]); // Run when component mounts or wallet changes

  // Fetch staking breakdown when wallet address changes
  useEffect(() => {
    const fetchStakingBreakdown = async () => {
      if (!walletAddress) {
        setStakingBreakdown({ day: 0, week: 0, month: 0, total: 0 });
        return;
      }

      try {
        setLoadingStaking(true);
        // Staking service no longer uses caching - always fetches fresh data
        const breakdown = await StakingService.getStakingPeriodBreakdown(walletAddress);
        setStakingBreakdown(breakdown);
      } catch (error) {
        console.error('Failed to fetch staking breakdown:', error);
        setStakingBreakdown({ day: 0, week: 0, month: 0, total: 0 });
      } finally {
        setLoadingStaking(false);
      }
    };

    fetchStakingBreakdown();
  }, [walletAddress]);


  return (
    <div className={`min-h-screen flex transition-colors duration-300 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <PortalSidebar
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:ml-4 min-h-screen">
        <main className="flex-1 p-3 sm:p-4 lg:p-6 mt-16 lg:mt-0 mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 xl:px-16 2xl:px-32">
          {userLoading ? (
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
                      {userLoading ? (
                        <div className={`h-8 rounded animate-pulse w-12 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'}`}></div>
                      ) : (
                        <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {claimStatus?.nftCount ?? 0}
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
                      {loadingStaking ? (
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
                      {loadingStaking ? (
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
                      {loadingStaking ? (
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

                {/* Unified Daily Claim Card */}
                <div className="sm:col-span-4 col-span-2">
                  <div className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 hover:shadow-lg ${isDarkMode
                      ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                      : 'bg-gradient-to-br from-white to-gray-50 border-gray-200'
                    }`}>
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-pink-500/5 to-transparent" />
                    <div className="relative p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className={`text-sm font-semibold mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                            Daily Rewards
                          </h3>
                          <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            Claim points from NFTs {(claimStatus?.stakedNFTCount ?? 0) > 0 ? 'and staked NFTs' : ''}
                          </p>
                        </div>
                        <div className={`p-2.5 rounded-xl ${isDarkMode ? 'bg-gradient-to-br from-purple-500/20 to-pink-500/20' : 'bg-gradient-to-br from-purple-100 to-pink-100'
                          }`}>
                          <Gift className="w-5 h-5 text-purple-600" />
                        </div>
                      </div>
                      <div className="space-y-3">
                        {userLoading ? (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div className={`h-3 rounded animate-pulse w-32 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'}`}></div>
                              <div className={`h-3 rounded animate-pulse w-24 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'}`}></div>
                            </div>
                            <div className={`h-10 rounded-lg animate-pulse w-full ${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'}`}></div>
                          </div>
                        ) : claimStatus ? (
                          <>
                            {/* Points Breakdown */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                  Total: {claimStatus.potentialPoints.toFixed(1)} points
                                </span>
                                <div className={`flex items-center space-x-1 text-xs ${claimStatus.canClaim
                                    ? 'text-green-600'
                                    : isDarkMode ? 'text-gray-400' : 'text-gray-500'
                                  }`}>
                                  <div className={`w-1.5 h-1.5 rounded-full mr-2 ${claimStatus.canClaim ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                                    }`} />
                                  {claimStatus.canClaim ? 'Available now' : 'Check back later'}
                                </div>
                              </div>
                              {/* Show breakdown based on new calculation */}
                              <div className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                                {(claimStatus.nftCount + (claimStatus.stakedNFTCount ?? 0)) > 0 ? (
                                  <>
                                    {claimStatus.nftCount > 0 && (
                                      <span>{claimStatus.nftCount} available NFTs (×5 = {(claimStatus.nftCount * 5).toFixed(1)} pts) </span>
                                    )}
                                    {(claimStatus.stakedNFTCount ?? 0) > 0 && (
                                      <span>
                                        {claimStatus.nftCount > 0 && '+ '}
                                        {stakingBreakdown.day > 0 && `${stakingBreakdown.day} day-staked (×7) `}
                                        {stakingBreakdown.week > 0 && `${stakingBreakdown.week} week-staked (×10) `}
                                        {stakingBreakdown.month > 0 && `${stakingBreakdown.month} month-staked (×20) `}
                                        (= {claimStatus.stakingPoints?.toFixed(1)} pts)
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  'Regular user (1.0 pt)'
                                )}
                              </div>
                            </div>
                            <ClaimButtonWithCountdown
                              canClaim={claimStatus.canClaim}
                              secondsUntilNextClaim={claimStatus.secondsUntilNextClaim}
                              nftCount={claimStatus.nftCount + (claimStatus.stakedNFTCount ?? 0)}
                              potentialPoints={claimStatus.potentialPoints}
                              onClaim={handleClaimUnified}
                              claiming={claiming}
                            />
                          </>
                        ) : (
                          <div className={`text-center py-4 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            Unable to load claim status
                          </div>
                        )}
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