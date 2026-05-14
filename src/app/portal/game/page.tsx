'use client';

import { useState, useEffect } from 'react';
import { PortalSidebar } from '@/components/portal/PortalSidebar';
import { useTheme } from '@/contexts/ThemeContext';
import dynamic from 'next/dynamic';

// Dynamically import the game component to ensure it only loads on client side
const MarioGameConsoleV2 = dynamic(() => import('@/components/MarioGameConsoleV2'), {
  ssr: false,
  loading: () => {
    const { isDarkMode } = useTheme();
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className={`h-7 w-40 rounded animate-pulse ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`} />
          <div className={`h-9 w-28 rounded-lg animate-pulse ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`} />
        </div>
        <div className={`rounded-xl border overflow-hidden ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className={`animate-pulse ${isDarkMode ? 'bg-gray-700' : 'bg-gray-300'}`} style={{ width: '100%', aspectRatio: '1282/532' }} />
          <div className="p-4">
            <div className={`h-10 w-full rounded-lg animate-pulse ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`} />
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
          {isMounted && <MarioGameConsoleV2 />}
        </main>
      </div>
    </div>
  );
}
