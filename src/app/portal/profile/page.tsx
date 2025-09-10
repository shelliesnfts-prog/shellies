'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useAccount } from 'wagmi';
import { PortalSidebar } from '@/components/portal/PortalSidebar';
import { ClaimButtonWithCountdown } from '@/components/ClaimCountdown';
import { useDashboard } from '@/hooks/useDashboard';
import { NFTService, SHELLIES_CONTRACT_ADDRESS } from '@/lib/nft-service';
import { useRouter } from 'next/navigation';
import { Trophy, Coins, Gift, TrendingUp, ArrowRight, Sparkles, Target, Zap } from 'lucide-react';

export default function ProfilePage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const { data: session } = useSession();
  const { address } = useAccount();
  const router = useRouter();
  const { user, claimStatus, loading: userLoading, claiming, executeClaim, error: claimError, fetchUser } = useDashboard();

  const walletAddress = address || session?.address || '';

  // Get tier information for motivational display
  const nftCount = claimStatus?.nftCount ?? 0;
  const tierInfo = NFTService.getUserTierInfo(nftCount);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  const handleClaimDaily = async () => {
    const result = await executeClaim();
    if (result.success) {
      await fetchUser();
    }
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

  return (
    <div className={`min-h-screen flex transition-colors duration-300 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <PortalSidebar
        isDarkMode={isDarkMode}
        toggleDarkMode={toggleDarkMode}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:ml-4 min-h-screen">
        <main className="flex-1 p-3 sm:p-4 lg:p-6 mt-16 lg:mt-0 mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 xl:px-16 2xl:px-32">
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
              <div className={`px-3 py-1 rounded-full border ${
                isDarkMode 
                  ? 'bg-gray-800 border-gray-600 text-gray-300' 
                  : 'bg-gray-50 border-gray-200 text-gray-600'
              }`}>
                <span className="text-xs font-medium">
                  {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'Not connected'}
                </span>
              </div>
            </div>
 {/* Tier Progression Motivation Section */}
            {!userLoading && claimStatus && (
              <div className="space-y-6">
                {/* Regular User - Motivate to get NFTs */}
                {tierInfo.currentTier === 'Regular' && (
                  <div className={`relative overflow-hidden rounded-2xl border transition-all duration-300 ${
                    isDarkMode 
                      ? 'bg-gradient-to-br from-purple-900/40 to-pink-900/40 border-purple-700/50' 
                      : 'bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200'
                  }`}>
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 via-pink-600/10 to-purple-600/10 animate-pulse" />
                    <div className="relative p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center space-x-2 mb-2">
                            <Sparkles className="w-5 h-5 text-purple-600" />
                            <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              Level Up Your Rewards! 🚀
                            </h3>
                          </div>
                          <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            You're currently earning <span className="font-semibold text-purple-600">1.0 point</span> per day
                          </p>
                        </div>
                        <div className={`p-3 rounded-xl ${
                          isDarkMode ? 'bg-purple-500/20' : 'bg-purple-100'
                        }`}>
                          <Target className="w-6 h-6 text-purple-600" />
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <div className={`p-4 rounded-xl border-2 border-dashed ${
                          isDarkMode 
                            ? 'border-purple-600/50 bg-purple-900/20' 
                            : 'border-purple-300 bg-purple-50/50'
                        }`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className={`text-sm font-medium ${isDarkMode ? 'text-purple-300' : 'text-purple-700'}`}>
                                Own Shellies NFTs
                              </p>
                              <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                Get <span className="font-semibold text-purple-600">5.0 points per NFT</span> daily
                              </p>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Zap className="w-4 h-4 text-yellow-500" />
                              <span className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                5x
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="text-sm">
                            <p className={`font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                              Example: 3 NFTs = <span className="text-purple-600 font-bold">15.0 points</span> daily
                            </p>
                            <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                              That's 15x more than your current rewards!
                            </p>
                          </div>
                          <button
                            onClick={handleOpenNFTCollection}
                            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl font-medium transition-all duration-200 hover:scale-105 shadow-lg"
                          >
                            <span className="text-sm">Get NFTs</span>
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* NFT Holder - Motivate to stake */}
                {tierInfo.currentTier === 'NFT Holder' && tierInfo.potentialStakingPoints && (
                  <div className={`relative overflow-hidden rounded-2xl border transition-all duration-300 ${
                    isDarkMode 
                      ? 'bg-gradient-to-br from-blue-900/40 to-cyan-900/40 border-blue-700/50' 
                      : 'bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200'
                  }`}>
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-cyan-600/10 to-blue-600/10 animate-pulse" />
                    <div className="relative p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center space-x-2 mb-2">
                            <TrendingUp className="w-5 h-5 text-blue-600" />
                            <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              Double Your Earnings! ⚡
                            </h3>
                          </div>
                          <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            Currently earning <span className="font-semibold text-blue-600">{tierInfo.currentPoints.toFixed(1)} points</span> per day from {nftCount} NFT{nftCount !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <div className={`p-3 rounded-xl ${
                          isDarkMode ? 'bg-blue-500/20' : 'bg-blue-100'
                        }`}>
                          <Coins className="w-6 h-6 text-blue-600" />
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <div className={`p-4 rounded-xl border-2 border-dashed ${
                          isDarkMode 
                            ? 'border-blue-600/50 bg-blue-900/20' 
                            : 'border-blue-300 bg-blue-50/50'
                        }`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className={`text-sm font-medium ${isDarkMode ? 'text-blue-300' : 'text-blue-700'}`}>
                                Stake Your NFTs
                              </p>
                              <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                Get <span className="font-semibold text-blue-600">10.0 points per staked NFT</span> daily
                              </p>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Zap className="w-4 h-4 text-yellow-500" />
                              <span className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                2x
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="text-sm">
                            <p className={`font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                              Potential: <span className="text-blue-600 font-bold">{tierInfo.potentialStakingPoints.toFixed(1)} points</span> daily
                            </p>
                            <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                              That's {(tierInfo.potentialStakingPoints - tierInfo.currentPoints).toFixed(1)} more points per day!
                            </p>
                          </div>
                          <button
                            onClick={handleNavigateToStaking}
                            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-xl font-medium transition-all duration-200 hover:scale-105 shadow-lg"
                          >
                            <span className="text-sm">Start Staking</span>
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {/* NFT Holdings Card */}
              <div className={`h-fit group relative overflow-hidden rounded-2xl border transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${
                isDarkMode 
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 hover:border-purple-500' 
                  : 'bg-gradient-to-br from-white to-gray-50 border-gray-200 hover:border-purple-300'
              }`}>
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-2.5 rounded-xl ${
                      isDarkMode ? 'bg-purple-500/20' : 'bg-purple-100'
                    }`}>
                      <Trophy className="w-5 h-5 text-purple-600" />
                    </div>
                    <div className={`text-xs font-medium px-2 py-1 rounded-full ${
                      isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
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

              {/* Available Points Card */}
              <div className={`h-fit group relative overflow-hidden rounded-2xl border transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${
                isDarkMode 
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 hover:border-blue-500' 
                  : 'bg-gradient-to-br from-white to-gray-50 border-gray-200 hover:border-blue-300'
              }`}>
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-2.5 rounded-xl ${
                      isDarkMode ? 'bg-blue-500/20' : 'bg-blue-100'
                    }`}>
                      <Coins className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className={`text-xs font-medium px-2 py-1 rounded-full ${
                      isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
                    }`}>Ready</div>
                  </div>
                  <div className="space-y-1">
                    <h3 className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Available Points
                    </h3>
                    {userLoading ? (
                      <div className={`h-8 rounded animate-pulse w-16 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'}`}></div>
                    ) : (
                      <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        {(claimStatus?.currentPoints ?? user?.points ?? 0).toFixed(1)}
                      </p>
                    )}
                    <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                      {userLoading ? (
                        <div className={`h-3 rounded animate-pulse w-12 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'}`}></div>
                      ) : (
                        `Point${(claimStatus?.currentPoints ?? user?.points ?? 0) !== 1 ? 's' : ''} tokens`
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Daily Claim Card */}
              <div className="sm:col-span-2 lg:col-span-2">
                <div className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 hover:shadow-lg ${
                  isDarkMode 
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
                          Claim your daily points based on NFT holdings
                        </p>
                      </div>
                      <div className={`p-2.5 rounded-xl ${
                        isDarkMode ? 'bg-gradient-to-br from-purple-500/20 to-pink-500/20' : 'bg-gradient-to-br from-purple-100 to-pink-100'
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
                          <div className="flex items-center justify-between">
                            <span className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                              Potential: {claimStatus.potentialPoints.toFixed(1)} points
                            </span>
                            <div className={`flex items-center space-x-1 text-xs ${
                              claimStatus.canClaim 
                                ? 'text-green-600' 
                                : isDarkMode ? 'text-gray-400' : 'text-gray-500'
                            }`}>
                              <div className={`w-1.5 h-1.5 rounded-full mr-2 ${
                                claimStatus.canClaim ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                              }`} />
                              {claimStatus.canClaim ? 'Available now' : 'Check back later'}
                            </div>
                          </div>
                          <ClaimButtonWithCountdown
                            canClaim={claimStatus.canClaim}
                            secondsUntilNextClaim={claimStatus.secondsUntilNextClaim}
                            nftCount={claimStatus.nftCount}
                            potentialPoints={claimStatus.potentialPoints}
                            onClaim={handleClaimDaily}
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
              <div className={`p-4 rounded-xl border ${
                isDarkMode 
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
        </main>
      </div>
    </div>
  );
}