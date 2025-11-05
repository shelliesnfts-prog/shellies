'use client';

import { useState, useEffect } from 'react';
import { PortalSidebar } from '@/components/portal/PortalSidebar';
import { useTheme } from '@/contexts/ThemeContext';
import { useGamePayment } from '@/hooks/useGamePayment';
import dynamic from 'next/dynamic';

// Dynamically import the game component to ensure it only loads on client side
const MarioGameConsoleV2 = dynamic(() => import('@/components/MarioGameConsoleV2'), {
  ssr: false,
  loading: () => {
    const { isDarkMode } = useTheme();
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className={`h-8 w-48 rounded animate-pulse mb-2 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`} />
            <div className={`h-4 w-64 rounded animate-pulse ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`} />
          </div>
          <div className={`h-10 w-32 rounded-full animate-pulse ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`} />
        </div>

        {/* Game Container Skeleton */}
        <div className={`rounded-2xl border overflow-hidden ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="relative w-full bg-black flex items-center justify-center overflow-hidden">
            <div className={`animate-pulse ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`} style={{ width: '1282px', height: '532px', maxWidth: '100%' }} />
          </div>
          <div className="p-6 space-y-4">
            <div className={`h-12 w-full rounded-xl animate-pulse ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`} />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className={`h-16 rounded-xl animate-pulse ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`} />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }
});

export default function GamePage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const { isDarkMode } = useTheme();

  // Use the payment hook to check active payment status
  const { hasActivePayment } = useGamePayment();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <div className={`min-h-screen flex transition-colors duration-300 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <PortalSidebar
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:ml-4 min-h-screen">
        <main className="flex-1 p-3 sm:p-4 lg:p-6 mt-16 lg:mt-0 mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-8">
          {/* Always show game console - payment happens immediately when user clicks play */}
          {isMounted && <MarioGameConsoleV2 hasActivePayment={hasActivePayment} />}
        </main>
      </div>
    </div>
  );
}
