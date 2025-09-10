'use client';

import { useState, useEffect } from 'react';
import { PortalSidebar } from '@/components/portal/PortalSidebar';
import { BarChart3 } from 'lucide-react';

export default function LeaderboardPage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

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

  useEffect(() => {
    fetchLeaderboard();
  }, []);

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
          <div className="space-y-4">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className={`text-xl sm:text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Leaderboard
                </h1>
                <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Top players by points and NFT holdings
                </p>
              </div>
            </div>

            {/* Leaderboard Card */}
            <div className={`rounded-xl shadow-sm border overflow-hidden ${
              isDarkMode 
                ? 'bg-gray-800 border-gray-700' 
                : 'bg-white border-gray-200'
            }`}>
              <div className="p-4 overflow-x-auto">
                {leaderboardLoading ? (
                  <div className="text-center py-6">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600 mx-auto mb-3"></div>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-700'}`}>
                      Loading leaderboard...
                    </p>
                  </div>
                ) : (
                  <table className="w-full min-w-[500px]">
                    <thead>
                      <tr className={`border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                        <th className={`text-left py-2 font-medium text-sm ${
                          isDarkMode ? 'text-gray-300' : 'text-gray-600'
                        }`}>Rank</th>
                        <th className={`text-left py-2 font-medium text-sm ${
                          isDarkMode ? 'text-gray-300' : 'text-gray-600'
                        }`}>Address</th>
                        <th className={`text-left py-2 font-medium text-sm ${
                          isDarkMode ? 'text-gray-300' : 'text-gray-600'
                        }`}>Points</th>
                        <th className={`text-left py-2 font-medium text-sm ${
                          isDarkMode ? 'text-gray-300' : 'text-gray-600'
                        }`}>NFTs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.length > 0 ? leaderboard.map((user: any, index: number) => (
                        <tr key={user.id} className={`border-b ${
                          isDarkMode ? 'border-gray-700' : 'border-gray-100'
                        }`}>
                          <td className={`py-2 font-medium text-sm ${
                            isDarkMode ? 'text-gray-200' : 'text-gray-900'
                          }`}>#{index + 1}</td>
                          <td className={`py-2 text-sm ${
                            isDarkMode ? 'text-gray-300' : 'text-gray-700'
                          }`}>
                            {user.wallet_address.slice(0, 8)}...{user.wallet_address.slice(-8)}
                          </td>
                          <td className="py-2 text-purple-600 font-medium text-sm">{user.points}</td>
                          <td className="py-2 text-blue-600 text-sm">{user.nft_count}</td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={4} className={`py-6 text-center text-sm ${
                            isDarkMode ? 'text-gray-400' : 'text-gray-500'
                          }`}>
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
        </main>
      </div>
    </div>
  );
}