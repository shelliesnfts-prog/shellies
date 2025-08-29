'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useAccount } from 'wagmi';
import { useUser } from '@/hooks/useUser';
import { useClaiming } from '@/hooks/useClaiming';
import { ClaimButtonWithCountdown } from '@/components/ClaimCountdown';
import { 
  Trophy, 
  Coins, 
  BarChart3, 
  User, 
  LogOut,
  TrendingUp,
  Gift,
  Timer,
  Sparkles,
  Square,
  Sun,
  X,
  Wallet,
  MoreHorizontal,
  ChevronDown,
  Settings,
  HelpCircle,
  Bell,
  ImageOff
} from 'lucide-react';

import { Raffle } from '@/lib/supabase';

// Raffle Card Component
interface RaffleCardProps {
  raffle: Raffle;
  timeRemaining: string;
  isDarkMode: boolean;
}

function RaffleCard({ raffle, timeRemaining, isDarkMode }: RaffleCardProps) {
  const [imageError, setImageError] = useState(false);
  
  return (
    <div className={`group rounded-2xl shadow-sm border overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1 ${
      isDarkMode 
        ? 'bg-gray-800 border-gray-700 hover:border-gray-600' 
        : 'bg-white border-gray-100 hover:border-gray-200'
    }`}>
      {/* Image Section */}
      <div className="relative overflow-hidden">
        {/* Points Badge - Reduced opacity */}
        <div className="absolute top-3 right-3 bg-gradient-to-r from-purple-600/70 to-purple-700/70 backdrop-blur-sm text-white px-2 py-1 rounded-full text-xs font-medium shadow-md z-10">
          {raffle.points_per_ticket} pts
        </div>
        <div className="relative overflow-hidden rounded-t-2xl">
          {imageError || !raffle.image_url ? (
            <div className="w-full h-48 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
              <ImageOff className="w-10 h-10 text-gray-400" />
            </div>
          ) : (
            <>
              <img 
                src={raffle.image_url} 
                alt={raffle.title}
                className="w-full h-48 object-cover transition-transform duration-500 group-hover:scale-105"
                onError={() => setImageError(true)}
              />
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </>
          )}
        </div>
      </div>
      
      {/* Content Section */}
      <div className="p-4 space-y-3">
        {/* Title and Description */}
        <div className="space-y-1">
          <h3 className={`text-base font-semibold group-hover:text-purple-700 transition-colors duration-300 line-clamp-1 ${
            isDarkMode ? 'text-gray-100' : 'text-gray-900'
          }`}>{raffle.title}</h3>
          <p className={`text-xs leading-relaxed line-clamp-2 ${
            isDarkMode ? 'text-gray-300' : 'text-gray-600'
          }`}>{raffle.description}</p>
        </div>
        
        {/* Bottom Row: End Time + Join Button */}
        <div className="flex items-center justify-between pt-1">
          <div className={`flex items-center space-x-1.5 ${
            isDarkMode ? 'text-gray-400' : 'text-gray-500'
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${timeRemaining === 'Ended' ? 'bg-red-400' : 'bg-green-400 animate-pulse'}`}></div>
            <span className="text-xs font-medium">
              {timeRemaining === 'Ended' ? 'Ended' : `${timeRemaining}`}
            </span>
          </div>
          
          <button 
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-1.5 rounded-lg font-medium text-xs transition-all duration-200 hover:shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={timeRemaining === 'Ended'}
          >
            {timeRemaining === 'Ended' ? 'Ended' : 'Join'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Portal() {
  const [activeTab, setActiveTab] = useState('raffles');
  const [raffleView, setRaffleView] = useState('active');
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const { data: session } = useSession();
  const { address, isConnected } = useAccount();
  const { user, loading: userLoading } = useUser();
  const { claimStatus, claiming, executeClaim, error: claimError } = useClaiming();
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [rafflesLoading, setRafflesLoading] = useState(false);

  // Get wallet address from session or wagmi
  const walletAddress = address || session?.address || '';

  // Fetch leaderboard data
  const fetchLeaderboard = async () => {
    try {
      setLeaderboardLoading(true);
      const response = await fetch('/api/leaderboard?limit=10');
      if (response.ok) {
        const data = await response.json();
        setLeaderboard(data);
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLeaderboardLoading(false);
    }
  };

  // Fetch raffles data
  const fetchRaffles = async () => {
    try {
      setRafflesLoading(true);
      const response = await fetch(`/api/raffles?status=${raffleView}`);
      if (response.ok) {
        const data = await response.json();
        setRaffles(data);
      }
    } catch (error) {
      console.error('Error fetching raffles:', error);
    } finally {
      setRafflesLoading(false);
    }
  };

  // Handle daily points claim
  const handleClaimDaily = async () => {
    const result = await executeClaim();
    if (result.success) {
      // Refresh leaderboard after claiming
      fetchLeaderboard();
    }
  };

  const handleLogout = () => {
    signOut();
  };

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  useEffect(() => {
    if (activeTab === 'leaderboard') {
      fetchLeaderboard();
    } else if (activeTab === 'raffles') {
      fetchRaffles();
    }
  }, [activeTab, raffleView]);

  if (userLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 border border-gray-200 shadow-xl text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-700">Loading user data...</p>
        </div>
      </div>
    );
  }

  // Helper function to calculate time remaining
  const getTimeRemaining = (endDate: string) => {
    const now = new Date();
    const end = new Date(endDate);
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 0) return 'Ended';
    if (diffDays === 1) return '1 day';
    return `${diffDays} days`;
  };

  return (
    <div className={`min-h-screen flex transition-colors duration-300 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Floating Sidebar */}
      <div className="relative">
        {/* Mobile backdrop */}
        {isMobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
        
        {/* Sidebar */}
        <div className={`
          fixed lg:relative top-4 left-4 h-[calc(100vh-2rem)] w-64
          ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
          rounded-2xl shadow-xl border
          flex flex-col z-50 transition-all duration-300
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          {/* Top Section - Logo + Controls */}
          <div className={`p-6 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
            <div className="flex items-center justify-between">
              {/* Logo */}
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
              }`}>
                <Square className={`w-6 h-6 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`} />
              </div>
              
              {/* Control buttons */}
              <div className="flex items-center space-x-2">
                {/* Theme toggle */}
                <button 
                  onClick={toggleDarkMode}
                  className={`w-8 h-8 rounded-full flex items-center justify-center shadow-sm transition-all duration-200 hover:shadow-md ${
                    isDarkMode 
                      ? 'bg-gray-700 hover:bg-gray-600' 
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  {isDarkMode ? (
                    <Sun className="w-4 h-4 text-yellow-400" />
                  ) : (
                    <Sun className="w-4 h-4 text-gray-700" />
                  )}
                </button>
                
                {/* Close button - mobile only */}
                <button 
                  className={`w-8 h-8 rounded-full flex items-center justify-center shadow-sm transition-all duration-200 hover:shadow-md lg:hidden ${
                    isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <X className={`w-4 h-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Wallet Card Section */}
          <div className={`p-2 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
            <div className="relative group">
              {/* Wallet Card with Purple Gradient */}
              <div className="bg-gradient-to-r from-purple-600 to-purple-800 rounded-xl p-6 h-[145px] relative overflow-hidden cursor-pointer transition-transform duration-300 hover:scale-105">
                {/* Shimmer overlay effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 transform translate-x-full group-hover:translate-x-[-200%] transition-transform duration-1000" />
                
                {/* Content */}
                <div className="relative z-10 h-full flex flex-col justify-between">
                  {/* Top Row */}
                  <div className="flex items-start justify-between">
                    <h3 className="text-white text-xs font-bold">$SHELL</h3>
                    <button 
                      onClick={handleLogout}
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors duration-200"
                    >
                      <LogOut className="w-4 h-4 text-white/80 hover:text-white" />
                    </button>
                  </div>
                  
                  {/* Bottom Row */}
                  <div className="flex items-center ">
                     <p className="text-white text-sm font-bold mr-2">{user?.points || 0}</p>
                      <p className="text-white font-medium text-xs">SHELL</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Section */}
          <nav className="flex-1 px-4 py-6 overflow-y-auto">
            <ul className="space-y-1">
              {/* Raffles */}
              <li>
                <button
                  onClick={() => setActiveTab('raffles')}
                  className={`w-full flex items-center px-3 py-3 rounded-lg text-left transition-all duration-200 ${
                    activeTab === 'raffles' 
                      ? 'bg-gray-100 text-gray-900' 
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                  }`}
                >
                  <Gift className="w-5 h-5 mr-3" />
                  <span className="font-medium text-sm">Raffles</span>
                </button>
              </li>
              
              {/* Staking */}
              <li>
                <button
                  onClick={() => setActiveTab('staking')}
                  className={`w-full flex items-center px-3 py-3 rounded-lg text-left transition-all duration-200 ${
                    activeTab === 'staking' 
                      ? 'bg-gray-100 text-gray-900' 
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                  }`}
                >
                  <Coins className="w-5 h-5 mr-3" />
                  <span className="font-medium text-sm">Staking</span>
                </button>
              </li>
              
              {/* Trade */}
              <li>
                <button
                  onClick={() => setActiveTab('trade')}
                  className={`w-full flex items-center px-3 py-3 rounded-lg text-left transition-all duration-200 ${
                    activeTab === 'trade' 
                      ? 'bg-gray-100 text-gray-900' 
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                  }`}
                >
                  <TrendingUp className="w-5 h-5 mr-3" />
                  <span className="font-medium text-sm">Trade</span>
                </button>
              </li>
              
              {/* Leaderboard */}
              <li>
                <button
                  onClick={() => setActiveTab('leaderboard')}
                  className={`w-full flex items-center px-3 py-3 rounded-lg text-left transition-all duration-200 ${
                    activeTab === 'leaderboard' 
                      ? 'bg-gray-100 text-gray-900' 
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                  }`}
                >
                  <BarChart3 className="w-5 h-5 mr-3" />
                  <span className="font-medium text-sm">Leaderboard</span>
                </button>
              </li>
              
              {/* Profile */}
              <li>
                <button
                  onClick={() => setActiveTab('profile')}
                  className={`w-full flex items-center px-3 py-3 rounded-lg text-left transition-all duration-200 ${
                    activeTab === 'profile' 
                      ? 'bg-gray-100 text-gray-900' 
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                  }`}
                >
                  <User className="w-5 h-5 mr-3" />
                  <span className="font-medium text-sm">Profile</span>
                </button>
              </li>
              
              {/* More Dropdown */}
              <li className="relative">
                <button
                  onClick={() => setIsMoreOpen(!isMoreOpen)}
                  className={`w-full flex items-center px-3 py-3 rounded-lg text-left transition-all duration-200 ${
                    isMoreOpen 
                      ? 'bg-gray-100 text-gray-900' 
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                  }`}
                >
                  <MoreHorizontal className="w-5 h-5 mr-3" />
                  <span className="font-medium flex-1 text-sm">More</span>
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isMoreOpen ? 'rotate-180' : ''}`} />
                </button>
                
                {/* Dropdown content */}
                {isMoreOpen && (
                  <div className="mt-2 ml-8 space-y-1 border-l-2 border-gray-100 pl-4">
                    <button className="w-full flex items-center px-3 py-2 rounded-md text-left transition-all duration-200 text-gray-400 hover:bg-gray-50 hover:text-gray-600">
                      <Settings className="w-4 h-4 mr-3" />
                      <span className="text-xs font-medium">Settings</span>
                    </button>
                    <button className="w-full flex items-center px-3 py-2 rounded-md text-left transition-all duration-200 text-gray-400 hover:bg-gray-50 hover:text-gray-600">
                      <Bell className="w-4 h-4 mr-3" />
                      <span className="text-xs font-medium">Notifications</span>
                    </button>
                    <button className="w-full flex items-center px-3 py-2 rounded-md text-left transition-all duration-200 text-gray-400 hover:bg-gray-50 hover:text-gray-600">
                      <HelpCircle className="w-4 h-4 mr-3" />
                      <span className="text-xs font-medium">Help & Support</span>
                    </button>
                  </div>
                )}
              </li>
            </ul>
          </nav>
        </div>
        
        {/* Mobile menu toggle button */}
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="fixed top-6 left-6 w-10 h-10 bg-white rounded-lg shadow-md flex items-center justify-center lg:hidden z-30"
        >
          <MoreHorizontal className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:ml-4">
        {/* Content Area */}
        <main className="flex-1 p-3 lg:p-6 mt-16 lg:mt-0" style={{ marginLeft: '150px', marginRight: '150px' }}>
          {activeTab === 'raffles' && (
            <div className="space-y-4">
              {/* Tab Navigation */}
              <div className={`flex rounded-lg p-0.5 w-fit border ${
                isDarkMode 
                  ? 'bg-gray-800 border-gray-600' 
                  : 'bg-gray-50 border-gray-200'
              }`}>
                <button
                  onClick={() => setRaffleView('active')}
                  className={`px-3 py-1.5 rounded-md font-medium text-xs transition-all duration-300 ${
                    raffleView === 'active'
                      ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-md shadow-purple-600/25'
                      : `${isDarkMode ? 'text-gray-300 hover:text-purple-400 hover:bg-gray-700' : 'text-gray-600 hover:text-purple-600 hover:bg-gray-100'}`
                  }`}
                >
                  Active
                </button>
                <button
                  onClick={() => setRaffleView('finished')}
                  className={`px-3 py-1.5 rounded-md font-medium text-xs transition-all duration-300 ${
                    raffleView === 'finished'
                      ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-md shadow-purple-600/25'
                      : `${isDarkMode ? 'text-gray-300 hover:text-purple-400 hover:bg-gray-700' : 'text-gray-600 hover:text-purple-600 hover:bg-gray-100'}`
                  }`}
                >
                  Finished
                </button>
              </div>

              {/* Raffle Grid */}
              {rafflesLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-3"></div>
                  <p className="text-gray-600 text-sm">Loading raffles...</p>
                </div>
              ) : raffles.length === 0 ? (
                <div className="text-center py-8">
                  <Gift className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-gray-700 mb-1">No raffles found</h3>
                  <p className="text-gray-500 text-sm">
                    {raffleView === 'active' ? 'No active raffles at the moment' : 'No finished raffles to show'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  {raffles.map((raffle) => (
                    <RaffleCard 
                      key={raffle.id} 
                      raffle={raffle} 
                      timeRemaining={getTimeRemaining(raffle.end_date)}
                      isDarkMode={isDarkMode}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="space-y-4">
              <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
              
              {/* Stats Cards */}
              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-900">NFT Holdings</h3>
                    <Trophy className="w-4 h-4 text-purple-600" />
                  </div>
                  <p className="text-2xl font-bold text-purple-600">{claimStatus?.nftCount ?? 0}</p>
                  <p className="text-xs text-gray-500">Shellies NFTs</p>
                </div>
                
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-900">Available Points</h3>
                    <Coins className="w-4 h-4 text-blue-600" />
                  </div>
                  <p className="text-2xl font-bold text-blue-600">{claimStatus?.currentPoints ?? user?.points ?? 0}</p>
                  <p className="text-xs text-gray-500">Ready to use</p>
                </div>
                
                {claimStatus && (
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 shadow-sm border border-purple-200">
                    <ClaimButtonWithCountdown
                      canClaim={claimStatus.canClaim}
                      secondsUntilNextClaim={claimStatus.secondsUntilNextClaim}
                      nftCount={claimStatus.nftCount}
                      potentialPoints={claimStatus.potentialPoints}
                      onClaim={handleClaimDaily}
                      claiming={claiming}
                    />
                  </div>
                )}
              </div>
              
              {claimError && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-700 text-xs">⚠️ {claimError}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'leaderboard' && (
            <div className="space-y-4">
              <h1 className="text-2xl font-bold text-gray-900">Leaderboard</h1>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="p-4">
                  {leaderboardLoading ? (
                    <div className="text-center py-6">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600 mx-auto mb-3"></div>
                      <p className="text-gray-700 text-sm">Loading leaderboard...</p>
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left text-gray-600 py-2 font-medium text-sm">Rank</th>
                          <th className="text-left text-gray-600 py-2 font-medium text-sm">Address</th>
                          <th className="text-left text-gray-600 py-2 font-medium text-sm">Points</th>
                          <th className="text-left text-gray-600 py-2 font-medium text-sm">NFTs</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaderboard.length > 0 ? leaderboard.map((user: any, index: number) => (
                          <tr key={user.id} className="border-b border-gray-100">
                            <td className="py-2 text-gray-900 font-medium text-sm">#{index + 1}</td>
                            <td className="py-2 text-gray-700 text-sm">
                              {user.wallet_address.slice(0, 8)}...{user.wallet_address.slice(-8)}
                            </td>
                            <td className="py-2 text-purple-600 font-medium text-sm">{user.points}</td>
                            <td className="py-2 text-blue-600 text-sm">{user.nft_count}</td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan={4} className="py-6 text-center text-gray-500 text-sm">
                              No users found. Be the first to connect and claim points!
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}

          {(activeTab === 'staking' || activeTab === 'trade') && (
            <div className="space-y-4">
              <h1 className="text-2xl font-bold text-gray-900 capitalize">{activeTab}</h1>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  {activeTab === 'staking' ? <Coins className="w-6 h-6 text-gray-400" /> : <TrendingUp className="w-6 h-6 text-gray-400" />}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Coming Soon</h3>
                <p className="text-gray-600 text-sm">{activeTab === 'staking' ? 'Stake your SHELL tokens to earn rewards' : 'Trade your tokens on the marketplace'}</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}