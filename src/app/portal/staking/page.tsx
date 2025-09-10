'use client';

import { useState } from 'react';
import { PortalSidebar } from '@/components/portal/PortalSidebar';
import { Coins } from 'lucide-react';

export default function StakingPage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
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
          <div className="space-y-4">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className={`text-xl sm:text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Staking
                </h1>
                <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Stake your Points tokens to earn rewards
                </p>
              </div>
            </div>

            {/* Coming Soon Card */}
            <div className={`rounded-xl shadow-sm border p-6 text-center ${
              isDarkMode 
                ? 'bg-gray-800 border-gray-700' 
                : 'bg-white border-gray-200'
            }`}>
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 ${
                isDarkMode ? 'bg-gray-700' : 'bg-gray-100'
              }`}>
                <Coins className={`w-6 h-6 ${isDarkMode ? 'text-gray-400' : 'text-gray-400'}`} />
              </div>
              <h3 className={`text-lg font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Coming Soon
              </h3>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Stake your Points tokens to earn rewards. This feature will be available soon.
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}