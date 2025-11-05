'use client';

import { useState, useRef, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Gamepad2, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Trophy, X } from 'lucide-react';
import { useGameScore } from '@/hooks/useGameScore';
import { useTheme } from '@/contexts/ThemeContext';
import { useGamePayment } from '@/hooks/useGamePayment';
import { useWriteContract } from 'wagmi';
import { formatEther } from 'viem';
import { GamePaymentService } from '@/lib/contracts';
import { Shield, Coins, Info } from 'lucide-react';
import GameWalletPrompt from './GameWalletPrompt';
import PaymentLoadingOverlay from './PaymentLoadingOverlay';

interface MarioGameConsoleV2Props {
  hasActivePayment: boolean;
}

/**
 * Payment status states for the overlay
 */
type PaymentStatus =
  | 'idle'
  | 'signing'           // Waiting for wallet signature
  | 'confirming'        // Transaction confirming on blockchain
  | 'creating_session'  // Creating game session on server
  | 'loading_game'      // Loading game console
  | 'success'           // Complete
  | 'error';            // Error occurred

export default function MarioGameConsoleV2({ hasActivePayment }: MarioGameConsoleV2Props) {
  // ALL HOOKS MUST BE CALLED AT THE TOP LEVEL - NO CONDITIONAL RETURNS BEFORE HOOKS
  const { data: session } = useSession();
  const router = useRouter();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { isDarkMode } = useTheme();

  const [gameStarted, setGameStarted] = useState(false);
  const [levelInput, setLevelInput] = useState('');
  const [showPaymentOverlay, setShowPaymentOverlay] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('idle');
  const [currentStep, setCurrentStep] = useState(0);
  const [pendingGameAction, setPendingGameAction] = useState<'start' | 'restart' | null>(null);
  const [showPaymentInfo, setShowPaymentInfo] = useState(() => {
    // Check localStorage on mount to see if user has dismissed the banner
    if (typeof window !== 'undefined') {
      const dismissed = localStorage.getItem('hidePaymentInfoBanner');
      return dismissed !== 'true';
    }
    return true;
  });

  const { bestScore, updateScore, isLoading: scoreLoading } = useGameScore();
  const {
    clearPaymentSession,
    checkPaymentStatus,
    initiatePayment,
    paymentLoading,
    paymentError,
    canRetryPayment,
    sessionCreating,
    sessionCreated,
    ethPrice,
    requiredEth,
  } = useGamePayment();

  // Get transaction hash from wagmi
  const { data: hash } = useWriteContract();

  // Update payment status based on loading state with detailed steps
  useEffect(() => {
    if (paymentError) {
      setPaymentStatus('error');
      setCurrentStep(0);
    } else if (sessionCreated) {
      // Step 4: Game loading
      setPaymentStatus('loading_game');
      setCurrentStep(3);
      // Auto-close overlay and allow game to start
      setTimeout(() => {
        setPaymentStatus('success');
        setCurrentStep(4);
        setShowPaymentOverlay(false);

        // Notify game to proceed with pending action
        if (pendingGameAction && iframeRef.current?.contentWindow) {
          if (pendingGameAction === 'restart') {
            iframeRef.current.contentWindow.postMessage(
              { type: 'ALLOW_GAME_RESTART' },
              window.location.origin
            );
          } else {
            iframeRef.current.contentWindow.postMessage(
              { type: 'ALLOW_GAME_START' },
              window.location.origin
            );
          }
        }
        setPendingGameAction(null);
      }, 800);
    } else if (sessionCreating) {
      // Step 3: Creating session
      setPaymentStatus('creating_session');
      setCurrentStep(2);
    } else if (hash && !paymentLoading) {
      // Step 2: Transaction confirmed, waiting for session creation
      setPaymentStatus('confirming');
      setCurrentStep(2);
    } else if (hash && paymentLoading) {
      // Step 2: Transaction confirming
      setPaymentStatus('confirming');
      setCurrentStep(1);
    } else if (paymentLoading) {
      // Step 1: Waiting for signature
      setPaymentStatus('signing');
      setCurrentStep(0);
    } else if (!showPaymentOverlay) {
      setPaymentStatus('idle');
      setCurrentStep(0);
    }
  }, [paymentLoading, paymentError, hash, sessionCreating, sessionCreated, showPaymentOverlay, pendingGameAction]);

  // Handle payment initiation
  const handlePaymentInitiation = async (action: 'start' | 'restart') => {
    setPendingGameAction(action);
    setShowPaymentOverlay(true);
    setPaymentStatus('signing');
    setCurrentStep(0);

    // Initiate payment immediately
    await initiatePayment();
  };

  // Handle retry payment
  const handleRetryPayment = async () => {
    setPaymentStatus('signing');
    setCurrentStep(0);
    await initiatePayment();
  };

  // Handle postMessage events from game iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Validate origin for security
      if (event.origin !== window.location.origin) return;

      const { type, coins, level } = event.data;

      switch (type) {
        case 'GAME_START_ATTEMPT':
          // User clicked play button - check if they have active payment
          if (!hasActivePayment) {
            // Trigger payment immediately with overlay
            handlePaymentInitiation('start');
          } else {
            // Allow game to start
            if (iframeRef.current?.contentWindow) {
              iframeRef.current.contentWindow.postMessage(
                { type: 'ALLOW_GAME_START' },
                window.location.origin
              );
            }
          }
          break;

        case 'GAME_RESTART_ATTEMPT':
          // User clicked restart button - always require payment for new session
          // Clear current session first (both local and server)
          clearPaymentSession();

          // Clear server session asynchronously
          fetch('/api/game-session', { method: 'DELETE' }).catch(err =>
            console.error('Error clearing server session on restart:', err)
          );

          // Trigger payment immediately with overlay
          handlePaymentInitiation('restart');
          break;

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
          // IMPORTANT: Wait for score update to complete BEFORE clearing session
          // The API requires an active session to accept score updates
          if (coins > bestScore) {
            updateScore(coins, true).then(() => {
              // Clear payment session AFTER score is saved
              clearPaymentSession();

              // Also clear server-side session explicitly
              fetch('/api/game-session', { method: 'DELETE' }).catch(err =>
                console.error('Error clearing server session on game over:', err)
              );
            }).catch(err => {
              console.error('Error updating score:', err);
              // Still clear session even if score update fails
              clearPaymentSession();
              fetch('/api/game-session', { method: 'DELETE' }).catch(err =>
                console.error('Error clearing server session on game over:', err)
              );
            });
          } else {
            // No score update needed, clear session immediately
            clearPaymentSession();
            fetch('/api/game-session', { method: 'DELETE' }).catch(err =>
              console.error('Error clearing server session on game over:', err)
            );
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
  }, [bestScore, updateScore, router, clearPaymentSession, hasActivePayment]);

  // Listen for payment required events (from score submission failures)
  useEffect(() => {
    const handlePaymentRequired = (event: CustomEvent) => {
      console.log('Payment required - session expired during gameplay');
      // Clear payment session
      clearPaymentSession();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('paymentRequired', handlePaymentRequired as EventListener);

      return () => {
        window.removeEventListener('paymentRequired', handlePaymentRequired as EventListener);
      };
    }
  }, [clearPaymentSession]);

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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 m-auto mb-2">
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 m-auto mb-2">
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
        <div className={`flex items-center space-x-2 px-4 py-2 rounded-xl border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          }`}>
          <Trophy className="w-5 h-5 text-yellow-500" />
          <div>
            <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Your Best XP</p>
            <p className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{bestScore}</p>
          </div>
        </div>
      </div>

      {/* Payment Information Banner */}
      {showPaymentInfo && (
        <div className={`rounded-xl border p-6 relative ${isDarkMode
          ? 'bg-gradient-to-br from-purple-900/20 to-pink-900/20 border-purple-700/50'
          : 'bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200'
          }`}>
          {/* Close Button */}
          <button
            onClick={() => {
              setShowPaymentInfo(false);
              // Save to localStorage so banner stays hidden
              if (typeof window !== 'undefined') {
                localStorage.setItem('hidePaymentInfoBanner', 'true');
              }
            }}
            className={`absolute top-4 right-4 p-2 rounded-lg transition-colors duration-200 ${isDarkMode
              ? 'hover:bg-gray-700/50 text-gray-400 hover:text-white'
              : 'hover:bg-gray-200/50 text-gray-500 hover:text-gray-900'
              }`}
            aria-label="Close payment information"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-start gap-4 pr-8">
            <div className={`p-3 rounded-xl flex-shrink-0 ${isDarkMode ? 'bg-purple-500/20' : 'bg-purple-100'
              }`}>
              <Info className="w-6 h-6 text-purple-600" />
            </div>
            <div className="flex-1 space-y-3">
              <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Why Pay to Play?
              </h3>
              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  <Shield className={`w-5 h-5 mt-0.5 flex-shrink-0 ${isDarkMode ? 'text-purple-400' : 'text-purple-600'
                    }`} />
                  <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    <span className="font-semibold">Authenticity First:</span> We value real players and prevent bots from gaming the system. This small fee ensures fair competition on the leaderboard.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <Coins className={`w-5 h-5 mt-0.5 flex-shrink-0 ${isDarkMode ? 'text-purple-400' : 'text-purple-600'
                    }`} />
                  <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    <span className="font-semibold">Community Benefits:</span> All collected funds are reinvested into more raffles and rewards to benefit our Shellies community.
                  </p>
                </div>
              </div>
              {/* Payment Amount Display */}
              <div className={`mt-4 pt-4 border-t flex items-center justify-between flex-wrap gap-3 ${isDarkMode ? 'border-purple-700/50' : 'border-purple-200'
                }`}>
                <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Cost per game:
                </span>
                <div className="flex items-center gap-3">
                  {ethPrice && requiredEth > BigInt(0) ? (
                    <>
                      <span className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        ${GamePaymentService.convertEthToUsd(requiredEth, ethPrice).toFixed(4)} USD
                      </span>
                      <span className={`text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                        ({parseFloat(formatEther(requiredEth)).toFixed(8)} ETH)
                      </span>
                    </>
                  ) : (
                    <span className={`text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                      Loading price...
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Game Console */}
      <div className={`rounded-2xl border overflow-hidden transition-all duration-300 relative ${isDarkMode
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

        {/* Payment Loading Overlay */}
        <PaymentLoadingOverlay
          isVisible={showPaymentOverlay}
          paymentStatus={paymentStatus === 'idle' ? 'signing' : paymentStatus}
          currentStep={currentStep}
          transactionHash={hash || null}
          errorMessage={paymentError}
          canRetry={canRetryPayment}
          onRetry={handleRetryPayment}
        />

        {/* Level Navigation & Controls */}
        <div className="p-6 space-y-6">
          {/* Level Navigation */}
          <div>
            <label htmlFor="level-input" className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
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
                className={`flex-1 px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all ${isDarkMode
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
          <div className={`border rounded-xl p-6 ${isDarkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'
            }`}>
            <h3 className={`text-lg font-bold mb-4 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>
              <Gamepad2 className="w-5 h-5 text-purple-600" />
              Game Controls
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className={`flex items-center gap-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${isDarkMode ? 'bg-purple-500/20' : 'bg-purple-100'
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
                <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${isDarkMode ? 'bg-purple-500/20' : 'bg-purple-100'
                  }`}>
                  <span className="text-purple-600 font-bold">␣</span>
                </div>
                <div>
                  <div className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Space</div>
                  <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Jump</div>
                </div>
              </div>

              <div className={`flex items-center gap-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${isDarkMode ? 'bg-purple-500/20' : 'bg-purple-100'
                  }`}>
                  <span className="text-purple-600 font-bold text-xs">Shift</span>
                </div>
                <div>
                  <div className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Shift</div>
                  <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Run</div>
                </div>
              </div>

              <div className={`flex items-center gap-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${isDarkMode ? 'bg-purple-500/20' : 'bg-purple-100'
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
