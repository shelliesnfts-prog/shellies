'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useAccount } from 'wagmi';
import { useSearchParams } from 'next/navigation';
import { PortalSidebar } from '@/components/portal/PortalSidebar';
import { useTheme } from '@/contexts/ThemeContext';
import { LeaderboardPageSkeleton } from '@/components/portal/LeaderboardPageSkeleton';
import { GameStatsCards } from '@/components/portal/GameStatsCards';
import { StunningToggleSwitcher } from '@/components/portal/StunningToggleSwitcher';
import { Trophy, Medal, Award, Crown, Star, ChevronDown, Users, TrendingUp, Lock, Calendar, Clock, AlertCircle, RefreshCw, Search, X } from 'lucide-react';
import { StakingService } from '@/lib/staking-service';
import { formatXP } from '@/lib/format-utils';
import { useToast } from '@/hooks/useToast';
import { ToastContainer } from '@/components/Toast';

export default function LeaderboardPage() {
  const searchParams = useSearchParams();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Active leaderboard toggle state - check URL parameter for initial value
  const initialTab = searchParams.get('tab') === 'gameXP' ? 'gameXP' : 'points';
  const [activeLeaderboard, setActiveLeaderboard] = useState<'points' | 'gameXP'>(initialTab);
  
  // Transition state for smooth animations
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  
  // Points leaderboard state
  const [pointsLeaderboard, setPointsLeaderboard] = useState<any[]>([]);
  const [pointsLoading, setPointsLoading] = useState(true);
  const [pointsCursor, setPointsCursor] = useState<number | null>(null);
  const [pointsHasMore, setPointsHasMore] = useState(true);
  const [pointsCacheTimestamp, setPointsCacheTimestamp] = useState<number | null>(null);
  const [pointsError, setPointsError] = useState<string | null>(null);
  
  // Game XP leaderboard state
  const [gameXPLeaderboard, setGameXPLeaderboard] = useState<any[]>([]);
  const [gameXPLoading, setGameXPLoading] = useState(false);
  const [gameXPCursor, setGameXPCursor] = useState<number | null>(null);
  const [gameXPHasMore, setGameXPHasMore] = useState(true);
  const [gameXPCacheTimestamp, setGameXPCacheTimestamp] = useState<number | null>(null);
  const [gameXPError, setGameXPError] = useState<string | null>(null);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Current user rank state
  const [currentUserPointsRank, setCurrentUserPointsRank] = useState<{
    rank: number;
    wallet_address: string;
    points: number;
    game_score: number;
  } | null>(null);
  const [currentUserGameXPRank, setCurrentUserGameXPRank] = useState<{
    rank: number;
    wallet_address: string;
    points: number;
    game_score: number;
  } | null>(null);
  const [userRankLoading, setUserRankLoading] = useState(false);

  // Shared state
  const [loadingMore, setLoadingMore] = useState(false);
  const [stakingStats, setStakingStats] = useState({
    totalNFTsStaked: 0,
    totalStakers: 0,
    tokenHoldersCount: 0
  });
  const [gameStats, setGameStats] = useState({
    totalPlayers: 0,
    averageXP: 0,
    topScore: 0
  });
  const [statsLoading, setStatsLoading] = useState(true);
  const [gameStatsError, setGameStatsError] = useState<string | null>(null);

  const TOTAL_NFT_SUPPLY = 2222;
  const PAGE_SIZE = 50;
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

  const { isDarkMode } = useTheme();
  const { data: session } = useSession();
  const { address } = useAccount();
  const walletAddress = address || session?.address || '';
  const { toasts, removeToast, toast } = useToast();

  const isCacheValid = (timestamp: number | null): boolean => {
    if (!timestamp) return false;
    return Date.now() - timestamp < CACHE_DURATION;
  };

  const fetchPointsLeaderboard = async (cursorValue: number | null = null, append = false, forceRefresh = false, searchWallet?: string) => {
    try {
      if (!append) {
        setPointsLoading(true);
        setPointsError(null);
        if (searchWallet !== undefined) {
          setIsSearching(searchWallet.length > 0);
        }
      } else {
        setLoadingMore(true);
      }
      
      const params = new URLSearchParams({ limit: PAGE_SIZE.toString() });
      if (walletAddress) {
        params.append('userWallet', walletAddress);
      }
      if (cursorValue !== null) {
        params.append('cursor', cursorValue.toString());
      }
      // Use provided searchWallet or fall back to current debounced query
      const searchTerm = searchWallet !== undefined ? searchWallet : debouncedSearchQuery;
      if (searchTerm) {
        params.append('searchWallet', searchTerm);
      }
      
      const response = await fetch(`/api/leaderboard/points?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch points leaderboard: ${response.status} ${response.statusText}`);
      }
      
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
        setPointsLeaderboard(prev => [...prev, ...processedData]);
      } else {
        setPointsLeaderboard(processedData);
        // Update cache timestamp only on initial load or refresh
        setPointsCacheTimestamp(Date.now());
      }
      
      // Update cursor to the last user's points for next pagination
      if (processedData.length > 0) {
        const lastUser = processedData[processedData.length - 1];
        setPointsCursor(lastUser.points);
      }
      
      // Check if there are more entries (if we got less than PAGE_SIZE, no more data)
      setPointsHasMore(data.length === PAGE_SIZE);
      
      // Clear any previous errors
      setPointsError(null);
    } catch (error) {
      console.error('Error fetching points leaderboard:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load points leaderboard';
      setPointsError(errorMessage);
      
      // Show toast notification for network failures
      if (!append) {
        toast.error('Unable to load points leaderboard. Please try again.');
      } else {
        toast.error('Failed to load more entries. Please try again.');
      }
    } finally {
      setPointsLoading(false);
      setLoadingMore(false);
    }
  };

  const fetchGameXPLeaderboard = async (cursorValue: number | null = null, append = false, forceRefresh = false, searchWallet?: string) => {
    try {
      if (!append) {
        setGameXPLoading(true);
        setGameXPError(null);
        if (searchWallet !== undefined) {
          setIsSearching(searchWallet.length > 0);
        }
      } else {
        setLoadingMore(true);
      }
      
      const params = new URLSearchParams({ limit: PAGE_SIZE.toString() });
      if (walletAddress) {
        params.append('userWallet', walletAddress);
      }
      if (cursorValue !== null) {
        params.append('cursor', cursorValue.toString());
      }
      // Use provided searchWallet or fall back to current debounced query
      const searchTerm = searchWallet !== undefined ? searchWallet : debouncedSearchQuery;
      if (searchTerm) {
        params.append('searchWallet', searchTerm);
      }
      
      const response = await fetch(`/api/leaderboard/game-xp?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch game XP leaderboard: ${response.status} ${response.statusText}`);
      }
      
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
        setGameXPLeaderboard(prev => [...prev, ...processedData]);
      } else {
        setGameXPLeaderboard(processedData);
        // Update cache timestamp only on initial load or refresh
        setGameXPCacheTimestamp(Date.now());
      }
      
      // Update cursor to the last user's game_score for next pagination
      if (processedData.length > 0) {
        const lastUser = processedData[processedData.length - 1];
        setGameXPCursor(lastUser.game_score);
      }
      
      // Check if there are more entries (if we got less than PAGE_SIZE, no more data)
      setGameXPHasMore(data.length === PAGE_SIZE);
      
      // Clear any previous errors
      setGameXPError(null);
    } catch (error) {
      console.error('Error fetching game XP leaderboard:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load game XP leaderboard';
      setGameXPError(errorMessage);
      
      // Show toast notification for network failures
      if (!append) {
        toast.error('Unable to load game XP leaderboard. Please try again.');
      } else {
        toast.error('Failed to load more entries. Please try again.');
      }
    } finally {
      setGameXPLoading(false);
      setLoadingMore(false);
    }
  };

  const fetchGameStats = async () => {
    try {
      setGameStatsError(null);
      const response = await fetch('/api/leaderboard/game-stats');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch game stats: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      setGameStats(data);
      setGameStatsError(null);
    } catch (error) {
      console.error('Error fetching game stats:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load game statistics';
      setGameStatsError(errorMessage);
      
      // Show toast notification for network failures
      toast.error('Unable to load game statistics. Please try again.');
    }
  };

  const handleToggleLeaderboard = (type: 'points' | 'gameXP') => {
    if (type === activeLeaderboard) return;
    
    const transitionDuration = prefersReducedMotion ? 0 : 300;
    
    // Reset search when switching tabs
    setSearchQuery('');
    setDebouncedSearchQuery('');
    setIsSearching(false);
    
    // Check if we have valid cached data for the target leaderboard (only when not searching)
    const hasValidCache = type === 'gameXP' 
      ? gameXPLeaderboard.length > 0 && isCacheValid(gameXPCacheTimestamp)
      : pointsLeaderboard.length > 0 && isCacheValid(pointsCacheTimestamp);
    
    if (hasValidCache) {
      // Instant switch with cached data - no loading state
      setActiveLeaderboard(type);
      
      // Fetch stats if switching to game XP
      if (type === 'gameXP') {
        fetchGameStats();
      }
    } else {
      // Start fade-out transition for data fetch
      setIsTransitioning(true);
      
      // Wait for fade-out, then switch leaderboard
      setTimeout(() => {
        setActiveLeaderboard(type);
        
        // Fetch data if not cached or cache expired (without search filter)
        if (type === 'gameXP') {
          fetchGameXPLeaderboard(null, false, false, '');
          fetchGameStats();
        } else if (type === 'points') {
          fetchPointsLeaderboard(null, false, false, '');
        }
        
        // End transition after fade-in
        setTimeout(() => {
          setIsTransitioning(false);
        }, transitionDuration);
      }, transitionDuration);
    }
  };

  const loadMore = () => {
    if (activeLeaderboard === 'points' && pointsCursor !== null) {
      fetchPointsLeaderboard(pointsCursor, true, false, debouncedSearchQuery);
    } else if (activeLeaderboard === 'gameXP' && gameXPCursor !== null) {
      fetchGameXPLeaderboard(gameXPCursor, true, false, debouncedSearchQuery);
    }
  };

  const handleManualRefresh = () => {
    // Invalidate cache and force refresh current leaderboard
    if (activeLeaderboard === 'points') {
      setPointsCacheTimestamp(null);
      fetchPointsLeaderboard(null, false, true, debouncedSearchQuery);
      if (walletAddress) fetchUserRank('points');
    } else {
      setGameXPCacheTimestamp(null);
      fetchGameXPLeaderboard(null, false, true, debouncedSearchQuery);
      fetchGameStats();
      if (walletAddress) fetchUserRank('gameXP');
    }
  };

  const handleRetry = () => {
    // Retry fetching the current leaderboard
    if (activeLeaderboard === 'points') {
      setPointsError(null);
      fetchPointsLeaderboard(null, false, true, debouncedSearchQuery);
    } else {
      setGameXPError(null);
      fetchGameXPLeaderboard(null, false, true, debouncedSearchQuery);
      if (gameStatsError) {
        setGameStatsError(null);
        fetchGameStats();
      }
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setDebouncedSearchQuery('');
    setIsSearching(false);
  };

  // Optimized: Fetch both ranks in a single API call
  const fetchBothUserRanks = async () => {
    if (!walletAddress) return;

    try {
      setUserRankLoading(true);
      const params = new URLSearchParams({
        walletAddress,
        type: 'both'
      });

      const response = await fetch(`/api/leaderboard/user-rank?${params.toString()}`);

      if (!response.ok) {
        if (response.status === 404) {
          setCurrentUserPointsRank(null);
          setCurrentUserGameXPRank(null);
          return;
        }
        throw new Error('Failed to fetch user ranks');
      }

      const data = await response.json();

      // Set points rank
      if (data.pointsRank) {
        setCurrentUserPointsRank({
          rank: data.pointsRank.rank,
          wallet_address: data.wallet_address,
          points: data.pointsRank.points,
          game_score: data.gameXPRank?.game_score || 0
        });
      }

      // Set game XP rank
      if (data.gameXPRank) {
        setCurrentUserGameXPRank({
          rank: data.gameXPRank.rank,
          wallet_address: data.wallet_address,
          points: data.pointsRank?.points || 0,
          game_score: data.gameXPRank.game_score
        });
      }
    } catch (error) {
      console.error('Error fetching user ranks:', error);
    } finally {
      setUserRankLoading(false);
    }
  };

  // Single rank fetch for manual refresh (when we only need one)
  const fetchUserRank = async (type: 'points' | 'gameXP') => {
    if (!walletAddress) return;

    try {
      setUserRankLoading(true);
      const params = new URLSearchParams({
        walletAddress,
        type
      });

      const response = await fetch(`/api/leaderboard/user-rank?${params.toString()}`);

      if (!response.ok) {
        if (response.status === 404) {
          if (type === 'points') {
            setCurrentUserPointsRank(null);
          } else {
            setCurrentUserGameXPRank(null);
          }
          return;
        }
        throw new Error('Failed to fetch user rank');
      }

      const data = await response.json();

      if (type === 'points') {
        setCurrentUserPointsRank(data);
      } else {
        setCurrentUserGameXPRank(data);
      }
    } catch (error) {
      console.error(`Error fetching user ${type} rank:`, error);
    } finally {
      setUserRankLoading(false);
    }
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
    // Invalidate cache when wallet changes
    setPointsCacheTimestamp(null);
    setGameXPCacheTimestamp(null);

    // Fetch appropriate leaderboard based on initial tab
    if (initialTab === 'gameXP') {
      fetchGameXPLeaderboard();
    } else {
      fetchPointsLeaderboard();
    }

    // Optimized: Fetch both ranks in a single API call on initial load
    if (walletAddress) {
      fetchBothUserRanks();
    }
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

  // Check for reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Trigger search when debounced query changes
  useEffect(() => {
    // Reset pagination and fetch with search
    if (activeLeaderboard === 'points') {
      setPointsCursor(null);
      fetchPointsLeaderboard(null, false, false, debouncedSearchQuery);
    } else {
      setGameXPCursor(null);
      fetchGameXPLeaderboard(null, false, false, debouncedSearchQuery);
    }
  }, [debouncedSearchQuery]);

  // Fetch game stats when switching to game XP leaderboard
  useEffect(() => {
    if (activeLeaderboard === 'gameXP') {
      fetchGameStats();
    }
  }, [activeLeaderboard]);

  // Periodic cache validation - check every minute if cache has expired
  useEffect(() => {
    const intervalId = setInterval(() => {
      // Check if current leaderboard cache has expired
      if (activeLeaderboard === 'points' && !isCacheValid(pointsCacheTimestamp)) {
        // Cache expired, but don't auto-refresh to avoid disrupting user
        // User can manually refresh or switch leaderboards to get fresh data
        console.log('Points leaderboard cache expired');
      } else if (activeLeaderboard === 'gameXP' && !isCacheValid(gameXPCacheTimestamp)) {
        console.log('Game XP leaderboard cache expired');
      }
    }, 60000); // Check every minute

    return () => clearInterval(intervalId);
  }, [activeLeaderboard, pointsCacheTimestamp, gameXPCacheTimestamp]);

  const getRankIcon = (index: number, isCurrentUser: boolean = false) => {
    if (index === 0) return <Crown className="w-5 h-5 text-yellow-500" />;
    if (index === 1) return <Medal className="w-5 h-5 text-gray-400" />;
    if (index === 2) return <Award className="w-5 h-5 text-amber-600" />;
    if (index < 10) return <Star className="w-4 h-4 text-purple-500" />;
    return null;
  };

  const getRankBadge = (index: number, isCurrentUser: boolean = false) => {
    const baseClasses = `flex items-center justify-center min-w-[2.5rem] h-10 rounded-xl font-bold text-sm transition-all duration-200`;
    
    // Rank 1: Gold gradient with pulsing glow animation
    if (index === 0) {
      return `${baseClasses} bg-gradient-to-r from-yellow-500 to-amber-500 text-white shadow-lg animate-pulse-glow`;
    }
    
    // Rank 2: Silver gradient with subtle glow
    if (index === 1) {
      return `${baseClasses} bg-gradient-to-r from-gray-400 to-slate-500 text-white shadow-md hover:shadow-lg`;
    }
    
    // Rank 3: Bronze gradient with subtle glow
    if (index === 2) {
      return `${baseClasses} bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md hover:shadow-lg`;
    }
    
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
    <>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <div className={`min-h-screen flex transition-colors duration-300 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <PortalSidebar
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
        />

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:ml-4 min-h-screen">
        <main className="flex-1 p-3 sm:p-4 lg:p-6 mt-16 lg:mt-0 mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 xl:px-16 2xl:px-32">
          {(activeLeaderboard === 'points' ? pointsLoading : gameXPLoading) ? (
            <LeaderboardPageSkeleton isDarkMode={isDarkMode} count={10} />
          ) : (
          <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col gap-4">
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
              </div>
              
              {/* Toggle Switcher */}
              <div className="flex justify-center sm:justify-start">
                <StunningToggleSwitcher
                  activeTab={activeLeaderboard}
                  onTabChange={handleToggleLeaderboard}
                  isDarkMode={isDarkMode}
                />
              </div>

              {/* Wallet Address Search */}
              <div className="w-full max-w-md">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className={`w-5 h-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by wallet address..."
                    aria-label="Search leaderboard by wallet address"
                    className={`w-full pl-10 pr-10 py-3 rounded-xl border-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                      isDarkMode
                        ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-400 focus:border-purple-500'
                        : 'bg-white border-gray-200 text-gray-900 placeholder-gray-500 focus:border-purple-500'
                    }`}
                  />
                  {searchQuery && (
                    <button
                      onClick={handleClearSearch}
                      aria-label="Clear search"
                      className={`absolute inset-y-0 right-0 pr-3 flex items-center transition-colors ${
                        isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
                {isSearching && debouncedSearchQuery && (
                  <p className={`mt-2 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Showing results for "{debouncedSearchQuery}"
                  </p>
                )}
              </div>
            </div>

            {/* Stats Cards - Conditional Rendering */}
            <div 
              className="space-y-4 transition-opacity duration-300"
              style={{
                opacity: isTransitioning ? 0 : 1,
                transform: isTransitioning ? 'translateY(-10px)' : 'translateY(0)',
                transition: prefersReducedMotion 
                  ? 'none' 
                  : 'opacity 300ms ease-in-out, transform 300ms ease-in-out'
              }}
            >
              {activeLeaderboard === 'points' ? (
                // Points Leaderboard Stats
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                          Staked Nfts
                        </div>
                      </div>
                      <div className="space-y-1">
                        <h3 className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          Total NFTs Staked
                        </h3>
                        {statsLoading ? (
                          <div className={`h-9 rounded animate-pulse w-16 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'}`}></div>
                        ) : (
                          <div className="flex items-baseline gap-2">
                            <p className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              {stakingStats.totalNFTsStaked}
                            </p>
                            <p className={`text-sm font-semibold ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                              {((stakingStats.totalNFTsStaked / TOTAL_NFT_SUPPLY) * 100).toFixed(1)}%
                            </p>
                          </div>
                        )}
                        <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                          Of <span className={`text-sm font-semibold ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>{TOTAL_NFT_SUPPLY}</span> total supply
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Token Holders */}
                  <div className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${
                    isDarkMode
                      ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 hover:border-green-500'
                      : 'bg-gradient-to-br from-white to-green-50/30 border-green-200/60 hover:border-green-300 shadow-sm'
                  }`}>
                    <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="relative p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div className={`p-2.5 rounded-xl ${
                          isDarkMode ? 'bg-green-500/20' : 'bg-green-100'
                        }`}>
                          <Trophy className="w-5 h-5 text-green-600" />
                        </div>
                        <div className={`text-xs font-medium px-2 py-1 rounded-full ${
                          isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-green-50 text-green-700'
                        }`}>
                          Holders
                        </div>
                      </div>
                      <div className="space-y-1">
                        <h3 className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          Shellies NFT Holders
                        </h3>
                        {statsLoading ? (
                          <div className={`h-9 rounded animate-pulse w-16 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'}`}></div>
                        ) : (
                          <p className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                            {stakingStats.tokenHoldersCount}
                          </p>
                        )}
                        <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                          Active Holders
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
                          Stakers
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
              ) : (
                // Game XP Leaderboard Stats
                <GameStatsCards 
                  gameStats={gameStats}
                  statsLoading={statsLoading}
                  isDarkMode={isDarkMode}
                />
              )}
            </div>

            {/* ARIA Live Region for Screen Reader Announcements */}
            <div 
              role="status" 
              aria-live="polite" 
              aria-atomic="true"
              className="sr-only"
            >
              {activeLeaderboard === 'points' 
                ? 'Showing Points Leaderboard' 
                : 'Showing Game XP Leaderboard'}
              {(activeLeaderboard === 'points' ? pointsLoading : gameXPLoading) && ', Loading...'}
              {!(activeLeaderboard === 'points' ? pointsLoading : gameXPLoading) && 
               (activeLeaderboard === 'points' ? pointsLeaderboard : gameXPLeaderboard).length > 0 &&
               `, ${(activeLeaderboard === 'points' ? pointsLeaderboard : gameXPLeaderboard).length} entries loaded`}
            </div>

            {/* Leaderboard Container */}
            <div 
              id="leaderboard-panel"
              role="tabpanel"
              aria-labelledby={activeLeaderboard === 'points' ? 'points-tab' : 'gameXP-tab'}
              className={`rounded-2xl shadow-xl border-2 overflow-hidden ${
                isDarkMode 
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700/50' 
                  : 'bg-gradient-to-br from-white to-gray-50 border-gray-200'
              }`}
              style={{
                opacity: isTransitioning ? 0 : 1,
                transform: isTransitioning ? 'translateY(10px)' : 'translateY(0)',
                transition: prefersReducedMotion 
                  ? 'none' 
                  : 'opacity 300ms ease-in-out, transform 300ms ease-in-out'
              }}
            >
              {/* Error State */}
              {(activeLeaderboard === 'points' ? pointsError : gameXPError) && 
               !(activeLeaderboard === 'points' ? pointsLoading : gameXPLoading) ? (
                <div className="text-center py-16 px-6">
                  <div className={`w-16 h-16 mx-auto rounded-full ${
                    isDarkMode ? 'bg-red-900/20' : 'bg-red-100'
                  } flex items-center justify-center mb-4`}>
                    <AlertCircle className={`w-8 h-8 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`} />
                  </div>
                  <h3 className={`text-lg font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Failed to Load Leaderboard
                  </h3>
                  <p className={`text-sm mb-6 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {activeLeaderboard === 'points' 
                      ? 'Unable to load points leaderboard. Please check your connection and try again.'
                      : 'Unable to load game XP leaderboard. Please check your connection and try again.'}
                  </p>
                  <button
                    onClick={handleRetry}
                    aria-label="Retry loading leaderboard"
                    className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
                      isDarkMode ? 'focus:ring-offset-gray-900' : 'focus:ring-offset-white'
                    } ${
                      isDarkMode
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg hover:shadow-xl hover:scale-105'
                        : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg hover:shadow-xl hover:scale-105'
                    }`}
                  >
                    <RefreshCw className="w-4 h-4" aria-hidden="true" />
                    <span>Retry</span>
                  </button>
                </div>
              ) : (activeLeaderboard === 'points' ? pointsLoading : gameXPLoading) || isTransitioning ? (
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
                <>
                  {/* Pinned Current User Position Card */}
                  {walletAddress && !isSearching && (() => {
                    const currentUserRank = activeLeaderboard === 'points' ? currentUserPointsRank : currentUserGameXPRank;
                    const isUnranked = activeLeaderboard === 'gameXP' && currentUserRank?.rank === 0;

                    if (!currentUserRank) return null;

                    const metricValue = activeLeaderboard === 'points'
                      ? currentUserRank.points.toFixed(1)
                      : formatXP(currentUserRank.game_score || 0);
                    const metricLabel = activeLeaderboard === 'points' ? 'Points' : 'XP';

                    return (
                      <div
                        className={`p-4 sm:p-5 border-b-2 ${
                          isDarkMode
                            ? 'bg-gradient-to-r from-purple-900/60 via-pink-900/50 to-purple-900/60 border-purple-500/50'
                            : 'bg-gradient-to-r from-purple-100 via-pink-100 to-purple-100 border-purple-300'
                        }`}
                      >
                        <div className="flex items-center space-x-4">
                          {/* Rank Badge */}
                          <div className={`flex items-center justify-center min-w-[3rem] h-12 rounded-xl font-bold text-lg transition-all duration-200 ${
                            isUnranked
                              ? isDarkMode
                                ? 'bg-gray-700 text-gray-400'
                                : 'bg-gray-200 text-gray-500'
                              : isDarkMode
                                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/30'
                                : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/30'
                          }`}>
                            {isUnranked ? '—' : `#${currentUserRank.rank}`}
                          </div>

                          {/* User Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-3">
                              <div className={`w-11 h-11 rounded-xl ${
                                isDarkMode
                                  ? 'bg-gradient-to-br from-purple-500 to-pink-500'
                                  : 'bg-gradient-to-br from-purple-600 to-pink-600'
                              } flex items-center justify-center shadow-lg`}>
                                <span className="text-white font-bold text-sm">
                                  {currentUserRank.wallet_address.slice(2, 4).toUpperCase()}
                                </span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-semibold truncate ${
                                  isDarkMode ? 'text-purple-200' : 'text-purple-800'
                                }`}>
                                  {currentUserRank.wallet_address.slice(0, 12)}...{currentUserRank.wallet_address.slice(-8)}
                                </p>
                                <p className={`text-xs ${isDarkMode ? 'text-purple-300/70' : 'text-purple-600/70'}`}>
                                  {isUnranked ? 'Play to get ranked!' : 'Your Wallet'}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Score with YOU badge */}
                          <div className="flex items-center gap-3">
                            <div className="text-center">
                              <p className={`text-2xl font-bold ${
                                isDarkMode ? 'text-purple-200' : 'text-purple-700'
                              }`}>
                                {metricValue}
                              </p>
                              <p className={`text-xs font-medium ${isDarkMode ? 'text-purple-300/70' : 'text-purple-600/70'}`}>
                                {metricLabel}
                              </p>
                            </div>
                            <div className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                              isDarkMode
                                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                                : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                            }`}>
                              YOU
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                <div 
                  role="list" 
                  aria-label={`${activeLeaderboard === 'points' ? 'Points' : 'Game XP'} leaderboard entries`}
                  className="divide-y divide-gray-200 dark:divide-gray-700"
                >
                  {(activeLeaderboard === 'points' ? pointsLeaderboard : gameXPLeaderboard).length > 0 ? (activeLeaderboard === 'points' ? pointsLeaderboard : gameXPLeaderboard).map((user: any, index: number) => {
                    const isCurrentUser = user.isCurrentUser;
                    const metricValue = activeLeaderboard === 'points' 
                      ? user.points.toFixed(1) 
                      : formatXP(user.game_score || 0);
                    const metricLabel = activeLeaderboard === 'points' ? 'Points' : 'XP';
                    
                    return (
                      <div 
                        key={user.id} 
                        role="listitem"
                        aria-label={`Rank ${index + 1}: ${user.wallet_address.slice(0, 12)}...${user.wallet_address.slice(-8)}, ${metricValue} ${metricLabel}${isCurrentUser ? ', Your entry' : ''}`}
                        className={`relative p-4 sm:p-6 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl ${
                          isCurrentUser 
                            ? isDarkMode
                              ? 'bg-gradient-to-r from-purple-900/40 via-pink-900/30 to-purple-900/40 border-l-4 border-r-4 border-purple-500 shadow-lg shadow-purple-500/20'
                              : 'bg-gradient-to-r from-purple-100 via-pink-50 to-purple-100 border-l-4 border-r-4 border-purple-500 shadow-lg shadow-purple-500/20'
                            : isDarkMode
                              ? 'hover:bg-gray-800/70 hover:shadow-purple-500/10'
                              : 'hover:bg-gray-50 hover:shadow-purple-500/10'
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
                          
                          {/* Stats - Display based on active leaderboard */}
                          <div className="flex items-center gap-6">
                            <div className="text-center">
                              <p className={`text-xl font-bold ${
                                isCurrentUser ? 'text-purple-600' : activeLeaderboard === 'points' ? 'text-blue-600' : 'text-yellow-600'
                              }`}>
                                {activeLeaderboard === 'points' 
                                  ? user.points.toFixed(1) 
                                  : formatXP(user.game_score || 0)
                                }
                              </p>
                              <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                                {activeLeaderboard === 'points' ? 'Points' : 'XP'}
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
                        {isSearching ? (
                          <Search className={`w-8 h-8 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                        ) : (
                          <Users className={`w-8 h-8 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                        )}
                      </div>
                      <p className={`text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        {isSearching 
                          ? 'No wallets found' 
                          : activeLeaderboard === 'points' 
                            ? 'No points data yet' 
                            : 'No game XP data yet'}
                      </p>
                      <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                        {isSearching 
                          ? `No results matching "${debouncedSearchQuery}"`
                          : activeLeaderboard === 'points' 
                            ? 'Be the first to connect and claim points!' 
                            : 'Be the first to play and earn XP!'}
                      </p>
                      {isSearching && (
                        <button
                          onClick={handleClearSearch}
                          className={`mt-4 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            isDarkMode
                              ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          Clear search
                        </button>
                      )}
                    </div>
                  )}
                </div>
                </>
              )}
              
              {/* Load More Button */}
              {!(activeLeaderboard === 'points' ? pointsLoading : gameXPLoading) && (activeLeaderboard === 'points' ? pointsHasMore : gameXPHasMore) && (activeLeaderboard === 'points' ? pointsLeaderboard : gameXPLeaderboard).length > 0 && (
                <div className={`p-6 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    aria-label={loadingMore ? 'Loading more entries' : 'Load more leaderboard entries'}
                    className={`w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
                      isDarkMode ? 'focus:ring-offset-gray-900' : 'focus:ring-offset-white'
                    } ${
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
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                        <span>Loading more...</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4" aria-hidden="true" />
                        <span>Load More</span>
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
    </>
  );
}