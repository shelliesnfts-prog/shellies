'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useAccount } from 'wagmi';
import { useUser } from '@/hooks/useUser';

export default function Portal() {
  const [activeTab, setActiveTab] = useState('profile');
  const { data: session } = useSession();
  const { address, isConnected } = useAccount();
  const { user, loading: userLoading, claimDailyPoints, canClaimDaily } = useUser();
  const [claiming, setClaiming] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);

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

  // Handle daily points claim
  const handleClaimDaily = async () => {
    if (!user || !canClaimDaily) return;
    
    setClaiming(true);
    const success = await claimDailyPoints(user.nft_count || 1);
    if (success) {
      // Refresh leaderboard after claiming
      fetchLeaderboard();
    }
    setClaiming(false);
  };

  const handleLogout = () => {
    signOut();
  };

  useEffect(() => {
    if (activeTab === 'leaderboard') {
      fetchLeaderboard();
    }
  }, [activeTab]);

  if (userLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-8 border border-white/20 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400 mx-auto mb-4"></div>
          <p className="text-white">Loading user data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      {/* Header */}
      <header className="bg-black/20 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="text-2xl font-bold text-white">
              Shellies Portal
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-300">
                {walletAddress ? `${walletAddress.slice(0, 8)}...${walletAddress.slice(-8)}` : 'No wallet'}
              </div>
              <div className="bg-purple-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                {user?.points || 0} Points
              </div>
              <button
                onClick={handleLogout}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-black/10 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {['profile', 'raffles', 'leaderboard'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-2 border-b-2 font-medium text-sm capitalize transition-colors ${
                  activeTab === tab
                    ? 'border-purple-400 text-purple-400'
                    : 'border-transparent text-gray-300 hover:text-white hover:border-gray-300'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <h1 className="text-3xl font-bold text-white">Profile</h1>
            
            {/* Stats Cards */}
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
                <h3 className="text-lg font-semibold text-white mb-2">NFT Holdings</h3>
                <p className="text-3xl font-bold text-purple-400">{user?.nft_count || 0}</p>
                <p className="text-sm text-gray-400">Shellies NFTs</p>
              </div>
              
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
                <h3 className="text-lg font-semibold text-white mb-2">Available Points</h3>
                <p className="text-3xl font-bold text-blue-400">{user?.points || 0}</p>
                <p className="text-sm text-gray-400">Ready to use</p>
              </div>
              
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
                <h3 className="text-lg font-semibold text-white mb-2">Daily Claim</h3>
                <button 
                  onClick={handleClaimDaily}
                  disabled={!canClaimDaily || claiming}
                  className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 transform ${
                    canClaimDaily && !claiming
                      ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white hover:scale-105'
                      : 'bg-gray-600 text-gray-300 cursor-not-allowed'
                  }`}
                >
                  {claiming ? 'Claiming...' : `Claim ${user?.nft_count || 1} Points`}
                </button>
                <p className="text-sm text-gray-400 mt-2">
                  {canClaimDaily ? 'Available now!' : 'Available in 24h'}
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'raffles' && (
          <div className="space-y-6">
            <h1 className="text-3xl font-bold text-white">Active Raffles</h1>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Mock raffle cards */}
              {[1, 2, 3].map((raffle) => (
                <div key={raffle} className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
                  <div className="w-full h-48 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg mb-4 flex items-center justify-center">
                    <span className="text-4xl">🎁</span>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Rare NFT #{raffle}</h3>
                  <p className="text-gray-300 text-sm mb-4">Exclusive collectible with unique traits</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-gray-400">
                      <span>End Date:</span>
                      <span>2024-12-31</span>
                    </div>
                    <div className="flex justify-between text-gray-400">
                      <span>Points per ticket:</span>
                      <span>10</span>
                    </div>
                    <div className="flex justify-between text-gray-400">
                      <span>Max tickets:</span>
                      <span>5</span>
                    </div>
                  </div>
                  <button className="w-full mt-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white py-2 rounded-lg font-medium transition-all duration-200">
                    Join Raffle
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'leaderboard' && (
          <div className="space-y-6">
            <h1 className="text-3xl font-bold text-white">Leaderboard</h1>
            <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20">
              <div className="p-6">
                {leaderboardLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400 mx-auto mb-4"></div>
                    <p className="text-white">Loading leaderboard...</p>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/20">
                        <th className="text-left text-gray-300 py-3">Rank</th>
                        <th className="text-left text-gray-300 py-3">Address</th>
                        <th className="text-left text-gray-300 py-3">Points</th>
                        <th className="text-left text-gray-300 py-3">NFTs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.length > 0 ? leaderboard.map((user: any, index: number) => (
                        <tr key={user.id} className="border-b border-white/10">
                          <td className="py-3 text-white font-medium">#{index + 1}</td>
                          <td className="py-3 text-gray-300">
                            {user.wallet_address.slice(0, 8)}...{user.wallet_address.slice(-8)}
                          </td>
                          <td className="py-3 text-purple-400 font-medium">{user.points}</td>
                          <td className="py-3 text-blue-400">{user.nft_count}</td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-gray-400">
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
      </main>
    </div>
  );
}