'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useAccount } from 'wagmi';
import { PortalSidebar } from '@/components/portal/PortalSidebar';
import { useTheme } from '@/contexts/ThemeContext';
import { LeaderboardPageSkeleton } from '@/components/portal/LeaderboardPageSkeleton';
import { Trophy, Medal, Award, Crown, Star, ChevronDown, Users, TrendingUp, Lock, Calendar, Clock } from 'lucide-react';
import { StakingService } from '@/lib/staking-service';

export default function LeaderboardPage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentLimit, setCurrentLimit] = useState(10);
  const [stakingStats, setStakingStats] = useState({
    totalNFTsStaked: 0,
    totalStakers: 0
  });
  const [statsLoading, setStatsLoading] = useState(true);

  const { isDarkMode } = useTheme();
  const { data: session } = useSession();
  const { address } = useAccount();
  const walletAddress = address || session?.address || '';

  const fetchLeaderboard = async (limit = 10, append = false) => {
    try {
      if (!append) setLeaderboardLoading(true);
      else setLoadingMore(true);
      
      const params = new URLSearchParams({ limit: limit.toString() });
      if (walletAddress) {
        params.append('userWallet', walletAddress);
      }
      
      const response = await fetch(`/api/leaderboard?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        
        // Mark connected user for highlighting without moving position
        let processedData = [...data];
        if (walletAddress) {
          processedData = processedData.map(user => ({
            ...user,
            isCurrentUser: user.wallet_address.toLowerCase() === walletAddress.toLowerCase()
          }));
        }
        
        if (append) {
          setLeaderboard(prev => [...prev, ...processedData]);
        } else {
          setLeaderboard(processedData);
        }
        
        // Check if there are more entries
        setHasMore(data.length === limit);
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLeaderboardLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMore = () => {
    const newLimit = currentLimit + 10;
    setCurrentLimit(newLimit);
    fetchLeaderboard(newLimit, false);
  };

  const fetchStakingStats = async () => {
    try {
      // Only show loading skeleton on initial fetch, not on subsequent refreshes
      if (stakingStats.totalNFTsStaked === 0) {
        setStatsLoading(true);
      }
      const stats = await StakingService.getGlobalStakingStats();
      setStakingStats(stats);
    } catch (error) {
      console.error('Error fetching staking stats:', error);
      // Don't spam errors if fetch fails, just keep showing old data
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [walletAddress]);

  useEffect(() => {
    // Initial fetch
    fetchStakingStats();

    // Set up interval to refresh every 30 seconds (reduced from 5 to avoid rate limiting)
    const intervalId = setInterval(() => {
      fetchStakingStats();
    }, 30000);

    // Cleanup interval on unmount
    return () => clearInterval(intervalId);
  }, []);

  const getRankIcon = (index: number, isCurrentUser: boolean = false) => {
    if (index === 0) return <Crown className="w-5 h-5 text-yellow-500" />;
    if (index === 1) return <Medal className="w-5 h-5 text-gray-400" />;
    if (index === 2) return <Award className="w-5 h-5 text-amber-600" />;
    if (index < 10) return <Star className="w-4 h-4 text-purple-500" />;
    return null;
  };

  const getRankBadge = (index: number, isCurrentUser: boolean = false) => {
    const baseClasses = `flex items-center justify-center min-w-[2.5rem] h-10 rounded-xl font-bold text-sm transition-all duration-200`;
    
    if (index === 0) return `${baseClasses} bg-gradient-to-r from-yellow-500 to-amber-500 text-white shadow-lg`;
    if (index === 1) return `${baseClasses} bg-gradient-to-r from-gray-400 to-slate-500 text-white shadow-md`;
    if (index === 2) return `${baseClasses} bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md`;
    
    return `${baseClasses} ${
      isCurrentUser 
        ? isDarkMode 
          ? 'bg-purple-500/20 text-purple-300 border-2 border-purple-400/30' 
          : 'bg-purple-100 text-purple-700 border-2 border-purple-300/50'
        : isDarkMode 
          ? 'bg-gray-700 text-gray-300' 
          : 'bg-gray-100 text-gray-700'
    }`;
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
          {leaderboardLoading ? (
            <LeaderboardPageSkeleton isDarkMode={isDarkMode} count={10} />
          ) : (
          <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center space-x-3 mb-2">
                  <div className={`p-2 rounded-xl ${isDarkMode ? 'bg-purple-500/20' : 'bg-purple-100'}`}>
                    <TrendingUp className="w-6 h-6 text-purple-600" />
                  </div>
                  <h1 className={`text-2xl sm:text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Leaderboard
                  </h1>
                </div>
                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Top Shellies holders competing for the highest points
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`flex items-center space-x-2 px-3 py-2 rounded-xl ${
                  isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
                }`}>
                  <Users className="w-4 h-4 text-purple-600" />
                  <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    {leaderboard.length} Players
                  </span>
                </div>
              </div>
            </div>

            {/* Staking Stats Cards */}
            <div className="space-y-4">
              {/* First Row: Total NFTs Staked / Total Staked Members */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Total NFTs Staked */}
                <div className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${
                  isDarkMode
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 hover:border-blue-500'
                    : 'bg-gradient-to-br from-white to-blue-50/30 border-blue-200/60 hover:border-blue-300 shadow-sm'
                }`}>
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="relative p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className={`p-2.5 rounded-xl ${
                        isDarkMode ? 'bg-blue-500/20' : 'bg-blue-100'
                      }`}>
                        <Lock className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className={`text-xs font-medium px-2 py-1 rounded-full ${
                        isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-blue-50 text-blue-700'
                      }`}>
                        Global
                      </div>
                    </div>
                    <div className="space-y-1">
                      <h3 className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Total NFTs Staked
                      </h3>
                      {statsLoading ? (
                        <div className={`h-9 rounded animate-pulse w-16 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'}`}></div>
                      ) : (
                        <p className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {stakingStats.totalNFTsStaked}
                        </p>
                      )}
                      <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                        NFTs locked in staking
                      </p>
                    </div>
                  </div>
                </div>

                {/* Total Staked Members */}
                <div className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${
                  isDarkMode
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 hover:border-purple-500'
                    : 'bg-gradient-to-br from-white to-purple-50/30 border-purple-200/60 hover:border-purple-300 shadow-sm'
                }`}>
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="relative p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className={`p-2.5 rounded-xl ${
                        isDarkMode ? 'bg-purple-500/20' : 'bg-purple-100'
                      }`}>
                        <Users className="w-5 h-5 text-purple-600" />
                      </div>
                      <div className={`text-xs font-medium px-2 py-1 rounded-full ${
                        isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-purple-50 text-purple-700'
                      }`}>
                        Community
                      </div>
                    </div>
                    <div className="space-y-1">
                      <h3 className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Total Staked Members
                      </h3>
                      {statsLoading ? (
                        <div className={`h-9 rounded animate-pulse w-16 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'}`}></div>
                      ) : (
                        <p className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {stakingStats.totalStakers}
                        </p>
                      )}
                      <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                        Active stakers
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Leaderboard Container */}
            <div className={`rounded-2xl shadow-xl border-2 overflow-hidden ${
              isDarkMode 
                ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700/50' 
                : 'bg-gradient-to-br from-white to-gray-50 border-gray-200'
            }`}>
              {leaderboardLoading ? (
                <div className="text-center py-12">
                  <div className="relative mx-auto w-12 h-12 mb-4">
                    <div className="absolute inset-0 rounded-full border-4 border-purple-200 animate-pulse"></div>
                    <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-purple-600 animate-spin"></div>
                  </div>
                  <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Loading champions...
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {leaderboard.length > 0 ? leaderboard.map((user: any, index: number) => {
                    const isCurrentUser = user.isCurrentUser;
                    
                    return (
                      <div 
                        key={user.id} 
                        className={`relative p-4 sm:p-6 transition-all duration-200 hover:bg-opacity-80 ${
                          isCurrentUser 
                            ? isDarkMode
                              ? 'bg-gradient-to-r from-purple-900/30 to-pink-900/30 border-l-4 border-purple-500'
                              : 'bg-gradient-to-r from-purple-50 to-pink-50 border-l-4 border-purple-500'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                        }`}
                      >
                        {isCurrentUser && (
                          <div className="absolute top-2 right-2">
                            <div className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              isDarkMode ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700'
                            }`}>
                              You
                            </div>
                          </div>
                        )}
                        
                        <div className="flex items-center space-x-4">
                          {/* Rank Badge */}
                          <div className={getRankBadge(index, isCurrentUser)}>
                            {getRankIcon(index, isCurrentUser) || `#${index + 1}`}
                          </div>
                          
                          {/* User Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-3">
                              <div className={`w-10 h-10 rounded-xl ${
                                isDarkMode ? 'bg-gradient-to-br from-purple-600 to-pink-600' : 'bg-gradient-to-br from-purple-500 to-pink-500'
                              } flex items-center justify-center`}>
                                <span className="text-white font-bold text-sm">
                                  {user.wallet_address.slice(2, 4).toUpperCase()}
                                </span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium truncate ${
                                  isCurrentUser 
                                    ? isDarkMode ? 'text-purple-300' : 'text-purple-700'
                                    : isDarkMode ? 'text-gray-200' : 'text-gray-900'
                                }`}>
                                  {user.wallet_address.slice(0, 12)}...{user.wallet_address.slice(-8)}
                                </p>
                                <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                                  Wallet Address
                                </p>
                              </div>
                            </div>
                          </div>
                          
                          {/* Stats */}
                          <div className="flex items-center">
                            <div className="text-center">
                              <p className={`text-xl font-bold ${
                                isCurrentUser ? 'text-purple-600' : 'text-blue-600'
                              }`}>
                                {user.points.toFixed(1)}
                              </p>
                              <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                                Points
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="text-center py-12">
                      <div className={`w-16 h-16 mx-auto rounded-full ${
                        isDarkMode ? 'bg-gray-700' : 'bg-gray-100'
                      } flex items-center justify-center mb-4`}>
                        <Users className={`w-8 h-8 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                      </div>
                      <p className={`text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        No players yet
                      </p>
                      <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                        Be the first to connect and claim points!
                      </p>
                    </div>
                  )}
                </div>
              )}
              
              {/* Load More Button */}
              {!leaderboardLoading && hasMore && leaderboard.length > 0 && (
                <div className={`p-6 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className={`w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl font-medium transition-all duration-200 ${
                      loadingMore
                        ? isDarkMode 
                          ? 'bg-gray-700 text-gray-400 cursor-not-allowed' 
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : isDarkMode
                          ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg hover:shadow-xl hover:scale-105'
                          : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg hover:shadow-xl hover:scale-105'
                    }`}
                  >
                    {loadingMore ? (
                      <>
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        <span>Loading more...</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4" />
                        <span>Load More Players</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
          )}
        </main>
      </div>
    </div>
  );
}