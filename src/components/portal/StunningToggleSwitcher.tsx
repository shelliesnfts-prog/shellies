'use client';

import { Trophy, Gamepad2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface StunningToggleSwitcherProps {
  activeTab: 'points' | 'gameXP';
  onTabChange: (tab: 'points' | 'gameXP') => void;
  isDarkMode: boolean;
}

export function StunningToggleSwitcher({ 
  activeTab, 
  onTabChange, 
  isDarkMode 
}: StunningToggleSwitcherProps) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    // Check for reduced motion preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const transitionStyle = prefersReducedMotion 
    ? 'all 0ms' 
    : 'all 300ms cubic-bezier(0.34, 1.56, 0.64, 1)';

  const handleKeyDown = (e: React.KeyboardEvent, tab: 'points' | 'gameXP') => {
    // Handle Enter and Space key presses for keyboard navigation
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onTabChange(tab);
    }
  };

  return (
    <div 
      className={`relative inline-flex p-1 rounded-full transition-colors duration-300 ${
        isDarkMode 
          ? 'bg-gradient-to-r from-gray-700 to-gray-800' 
          : 'bg-gradient-to-r from-gray-200 to-gray-300'
      }`}
      role="tablist"
      aria-label="Leaderboard type selector"
    >
      {/* Sliding indicator with spring animation */}
      <div 
        className="absolute inset-y-1 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 shadow-lg"
        style={{ 
          left: activeTab === 'points' ? '4px' : '50%', 
          width: 'calc(50% - 4px)',
          transition: transitionStyle
        }}
        aria-hidden="true"
      />
      
      {/* Points Tab */}
      <button
        onClick={() => onTabChange('points')}
        onKeyDown={(e) => handleKeyDown(e, 'points')}
        className={`relative z-10 flex items-center gap-2 px-6 py-3 rounded-full transition-all duration-300 ${
          prefersReducedMotion ? '' : 'hover:scale-105'
        } ${
          activeTab === 'points'
            ? 'text-white'
            : isDarkMode
            ? 'text-gray-400 hover:text-gray-200'
            : 'text-gray-600 hover:text-gray-800'
        } focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
          isDarkMode ? 'focus:ring-offset-gray-800' : 'focus:ring-offset-white'
        }`}
        role="tab"
        aria-selected={activeTab === 'points'}
        aria-controls="leaderboard-panel"
        aria-label="Switch to Points Leaderboard"
        tabIndex={0}
      >
        <Trophy className="w-5 h-5" aria-hidden="true" />
        <span className="font-semibold text-sm">Points</span>
      </button>
      
      {/* Game XP Tab */}
      <button
        onClick={() => onTabChange('gameXP')}
        onKeyDown={(e) => handleKeyDown(e, 'gameXP')}
        className={`relative z-10 flex items-center gap-2 px-6 py-3 rounded-full transition-all duration-300 ${
          prefersReducedMotion ? '' : 'hover:scale-105'
        } ${
          activeTab === 'gameXP'
            ? 'text-white'
            : isDarkMode
            ? 'text-gray-400 hover:text-gray-200'
            : 'text-gray-600 hover:text-gray-800'
        } focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
          isDarkMode ? 'focus:ring-offset-gray-800' : 'focus:ring-offset-white'
        }`}
        role="tab"
        aria-selected={activeTab === 'gameXP'}
        aria-controls="leaderboard-panel"
        aria-label="Switch to Game XP Leaderboard"
        tabIndex={0}
      >
        <Gamepad2 className="w-5 h-5" aria-hidden="true" />
        <span className="font-semibold text-sm">Game XP</span>
      </button>
    </div>
  );
}
