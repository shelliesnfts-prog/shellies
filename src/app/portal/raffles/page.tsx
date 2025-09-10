'use client';

import { useState, useEffect } from 'react';
import { PortalSidebar } from '@/components/portal/PortalSidebar';
import { RaffleCard } from '@/components/portal/RaffleCard';
import JoinRaffleModal from '@/components/JoinRaffleModal';
import { Gift } from 'lucide-react';
import { Raffle } from '@/lib/supabase';
import { useDashboard } from '@/hooks/useDashboard';

export default function RafflesPage() {
  const [raffleView, setRaffleView] = useState('active');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [rafflesLoading, setRafflesLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRaffle, setSelectedRaffle] = useState<Raffle | null>(null);
  const { fetchUser } = useDashboard();

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

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  const handleJoinRaffle = (raffle: Raffle) => {
    setSelectedRaffle(raffle);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedRaffle(null);
  };

  const handleRaffleSuccess = () => {
    fetchUser();
  };

  useEffect(() => {
    fetchRaffles();
  }, [raffleView]);

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
                  Raffles
                </h1>
                <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Join raffles and win amazing NFTs
                </p>
              </div>
            </div>

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
                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Loading raffles...</p>
              </div>
            ) : raffles.length === 0 ? (
              <div className="text-center py-8">
                <Gift className={`w-12 h-12 mx-auto mb-3 ${isDarkMode ? 'text-gray-500' : 'text-gray-300'}`} />
                <h3 className={`text-lg font-semibold mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  No raffles found
                </h3>
                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  {raffleView === 'active' ? 'No active raffles at the moment' : 'No finished raffles to show'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {raffles.map((raffle) => (
                  <RaffleCard 
                    key={raffle.id} 
                    raffle={raffle} 
                    isDarkMode={isDarkMode}
                    onJoinClick={() => handleJoinRaffle(raffle)}
                  />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Join Raffle Modal */}
      <JoinRaffleModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        raffle={selectedRaffle}
        isDarkMode={isDarkMode}
        onSuccess={handleRaffleSuccess}
      />
    </div>
  );
}