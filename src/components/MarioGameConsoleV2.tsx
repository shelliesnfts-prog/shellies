'use client';

import { useState, useRef, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Gamepad2, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Trophy } from 'lucide-react';
import { useGameScore } from '@/hooks/useGameScore';
import { useTheme } from '@/contexts/ThemeContext';
import GameWalletPrompt from './GameWalletPrompt';

export default function MarioGameConsoleV2() {
  // ALL HOOKS MUST BE CALLED AT THE TOP LEVEL - NO CONDITIONAL RETURNS BEFORE HOOKS
  const { data: session } = useSession();
  const router = useRouter();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { isDarkMode } = useTheme();
  
  const [gameStarted, setGameStarted] = useState(false);
  const [levelInput, setLevelInput] = useState('');
  
  const { bestScore, updateScore, isLoading: scoreLoading } = useGameScore();

  // Handle postMessage events from game iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Validate origin for security
      if (event.origin !== window.location.origin) return;

      const { type, coins, level } = event.data;

      switch (type) {
        case 'GAME_STARTED':
          setGameStarted(true);
          // Send best score to game
          if (iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.postMessage(
              { type: 'BEST_SCORE', bestScore },
              window.location.origin
            );
          }
          break;

        case 'GAME_OVER':
          // Update score if it's a new best (immediate update)
          if (coins > bestScore) {
            updateScore(coins, true);
          }
          break;

        case 'LEVEL_COMPLETED':
          // Don't persist score, just send current best
          if (iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.postMessage(
              { type: 'BEST_SCORE', bestScore },
              window.location.origin
            );
          }
          break;

        case 'GAME_RESTART':
          setGameStarted(true);
          break;

        case 'NAVIGATE_TO_LEADERBOARD':
          router.push('/portal/leaderboard');
          break;

        default:
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [bestScore, updateScore, router]);

  // Handle level navigation
  const handleLevelNavigation = () => {
    const level = parseInt(levelInput, 10);
    
    // Validate level number (1-999)
    if (isNaN(level) || level < 1 || level > 999) {
      alert('Please enter a valid level number between 1 and 999');
      return;
    }

    // Send navigate command to game
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        { type: 'NAVIGATE_TO_LEVEL', level },
        window.location.origin
      );
    }
  };

  // Handle Enter key press in level input
  const handleLevelInputKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleLevelNavigation();
    }
  };

  // CONDITIONAL RENDERING AFTER ALL HOOKS
  // If not connected, show wallet prompt
  if (!session?.address) {
    return <GameWalletPrompt />;
  }

  // Show skeleton loader while loading score
  if (scoreLoading) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 m-auto">
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

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 m-auto">
        <div>
          <div className="flex items-center space-x-3 mb-2">
            <div className={`p-2 rounded-xl ${isDarkMode ? 'bg-purple-500/20' : 'bg-purple-100'}`}>
              <Gamepad2 className="w-6 h-6 text-purple-600" />
            </div>
            <h1 className={`text-2xl sm:text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Shellies Game
            </h1>
          </div>
          <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Play the Mario-inspired platformer and compete on the leaderboard
          </p>
        </div>
        <div className={`flex items-center space-x-2 px-4 py-2 rounded-xl border ${
          isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <Trophy className="w-5 h-5 text-yellow-500" />
          <div>
            <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Best Score</p>
            <p className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{bestScore}</p>
          </div>
        </div>
      </div>

      {/* Game Console */}
      <div className={`rounded-2xl border overflow-hidden transition-all duration-300 ${
        isDarkMode 
          ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700' 
          : 'bg-gradient-to-br from-white to-gray-50 border-gray-200'
      }`}>
        {/* Game Iframe */}
        <div className="relative w-full bg-black flex items-center justify-center overflow-hidden">
          <div className="relative" style={{ width: '1282px', height: '532px', maxWidth: '100%' }}>
            <iframe
              ref={iframeRef}
              src="/mario-game-v2/index.html"
              className="w-full h-full"
              style={{ border: 'none', display: 'block' }}
              title="Shellies Game"
              allow="autoplay"
            />
          </div>
        </div>

        {/* Level Navigation & Controls */}
        <div className="p-6 space-y-6">
          {/* Level Navigation */}
          <div>
            <label htmlFor="level-input" className={`block text-sm font-medium mb-2 ${
              isDarkMode ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Navigate to Level (1-999)
            </label>
            <div className="flex gap-2">
              <input
                id="level-input"
                type="number"
                min="1"
                max="999"
                value={levelInput}
                onChange={(e) => setLevelInput(e.target.value)}
                onKeyPress={handleLevelInputKeyPress}
                placeholder="Enter level"
                className={`flex-1 px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all ${
                  isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                }`}
              />
              <button
                onClick={handleLevelNavigation}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300"
              >
                Go
              </button>
            </div>
          </div>

          {/* Game Controls */}
          <div className={`border rounded-xl p-6 ${
            isDarkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'
          }`}>
            <h3 className={`text-lg font-bold mb-4 flex items-center gap-2 ${
              isDarkMode ? 'text-white' : 'text-gray-900'
            }`}>
              <Gamepad2 className="w-5 h-5 text-purple-600" />
              Game Controls
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className={`flex items-center gap-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${
                  isDarkMode ? 'bg-purple-500/20' : 'bg-purple-100'
                }`}>
                  <ArrowUp className="w-5 h-5 text-purple-600" />
                  <ArrowDown className="w-5 h-5 text-purple-600 -ml-5" />
                  <ArrowLeft className="w-5 h-5 text-purple-600 -ml-5" />
                  <ArrowRight className="w-5 h-5 text-purple-600 -ml-5" />
                </div>
                <div>
                  <div className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Arrow Keys</div>
                  <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Move</div>
                </div>
              </div>
              
              <div className={`flex items-center gap-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${
                  isDarkMode ? 'bg-purple-500/20' : 'bg-purple-100'
                }`}>
                  <span className="text-purple-600 font-bold">␣</span>
                </div>
                <div>
                  <div className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Space</div>
                  <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Jump</div>
                </div>
              </div>
              
              <div className={`flex items-center gap-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${
                  isDarkMode ? 'bg-purple-500/20' : 'bg-purple-100'
                }`}>
                  <span className="text-purple-600 font-bold text-xs">Shift</span>
                </div>
                <div>
                  <div className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Shift</div>
                  <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Run</div>
                </div>
              </div>
              
              <div className={`flex items-center gap-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${
                  isDarkMode ? 'bg-purple-500/20' : 'bg-purple-100'
                }`}>
                  <span className="text-purple-600 font-bold text-xs">Ctrl</span>
                </div>
                <div>
                  <div className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Ctrl</div>
                  <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Fire</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
