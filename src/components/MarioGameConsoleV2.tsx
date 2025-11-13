'use client';

import { useState, useRef, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Gamepad2, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Trophy, X } from 'lucide-react';
import { useGameScore } from '@/hooks/useGameScore';
import { useTheme } from '@/contexts/ThemeContext';
import { useGamePayment } from '@/hooks/useGamePayment';
import { useNFTAnalytics } from '@/hooks/useNFTAnalytics';
import { useWriteContract } from 'wagmi';
import { formatEther } from 'viem';
import { GamePaymentService } from '@/lib/contracts';
import { Shield, Coins, Info } from 'lucide-react';
import GameWalletPrompt from './GameWalletPrompt';
import PaymentLoadingOverlay from './PaymentLoadingOverlay';

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

export default function MarioGameConsoleV2() {
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
  const [paymentTiers, setPaymentTiers] = useState<any[]>([]);
  const [tiersLoading, setTiersLoading] = useState(true);

  const { bestScore, updateScore, isLoading: scoreLoading } = useGameScore();
  const {
    hasActivePayment,
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
    isStaker,
    isNFTHolder,
    nftCount,
    paymentTier,
  } = useGamePayment();

  // Get NFT analytics for displaying counts on payment tiers
  const { nftCount: userNftCount, stakedCount: userStakedCount } = useNFTAnalytics();

  // Get transaction hash from wagmi
  const { data: hash } = useWriteContract();

  // Fetch payment tiers dynamically
  useEffect(() => {
    const fetchPaymentTiers = async () => {
      try {
        setTiersLoading(true);
        const response = await fetch('/api/payment-tiers');
        const data = await response.json();
        if (data.tiers) {
          // Sort tiers in static order: regular -> nft_holder -> staker
          const tierOrder = ['regular', 'nft_holder', 'staker'];
          const sortedTiers = data.tiers.sort((a: any, b: any) => {
            const aIndex = tierOrder.indexOf(a.tier_name);
            const bIndex = tierOrder.indexOf(b.tier_name);
            // If tier not in order list, put it at the end
            const aPos = aIndex === -1 ? 999 : aIndex;
            const bPos = bIndex === -1 ? 999 : bIndex;
            return aPos - bPos;
          });
          setPaymentTiers(sortedTiers);
        }
      } catch (error) {
        console.error('Error fetching payment tiers:', error);
      } finally {
        setTiersLoading(false);
      }
    };

    fetchPaymentTiers();
  }, []);

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
          // Set game as not started to allow page scrolling again
          setGameStarted(false);

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
          router.push('/portal/leaderboard?tab=gameXP');
          break;

        case 'NAVIGATE_TO_PROFILE':
          router.push('/portal/profile');
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

  // Prevent arrow keys from scrolling the page when game is active
  useEffect(() => {
    if (gameStarted) {
      // Prevent default scrolling behavior for arrow keys
      const preventArrowKeyScroll = (e: KeyboardEvent) => {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.key)) {
          e.preventDefault();
        }
      };

      // Add event listener with capture phase to catch it early
      window.addEventListener('keydown', preventArrowKeyScroll, { capture: true });

      return () => {
        window.removeEventListener('keydown', preventArrowKeyScroll, { capture: true });
      };
    }
  }, [gameStarted]);

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

        {/* Payment Information Banner Skeleton */}
        <div className={`rounded-xl border p-6 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-xl animate-pulse ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`} />
            <div className="flex-1 space-y-3">
              <div className={`h-6 w-40 rounded animate-pulse ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`} />
              <div className={`h-4 w-full rounded animate-pulse ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`} />
              <div className={`h-4 w-3/4 rounded animate-pulse ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`} />
              <div className={`h-10 w-full rounded animate-pulse mt-4 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`} />
            </div>
          </div>
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
            <div className="flex-1 space-y-4">
              <h3 className={`text-3xl font-black bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent`}>
                Shellies Mario Game — Q&A About the New Play Fee System
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className={`text-base font-bold ${isDarkMode ? 'text-purple-300' : 'text-purple-700'}`}>
                    Q: Why did we add a small payment fee to play Shellies Mario Game?
                  </p>
                  <p className={`text-base ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                    A: This system helps us make sure only real players join the game, not bots. It keeps the gameplay fair and fun for everyone in the community.
                  </p>
                </div>

                <div className="space-y-2">
                  <p className={`text-base font-bold ${isDarkMode ? 'text-purple-300' : 'text-purple-700'}`}>
                    Q: Will Shellies holders have to pay the same fee as everyone else?
                  </p>
                  <p className={`text-base ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                    A: No! Shellies holders will pay a much lower fee, and stakers will pay even less. The goal is to reward our loyal holders and stakers.
                  </p>
                </div>

                <div className="space-y-2">
                  <p className={`text-base font-bold ${isDarkMode ? 'text-purple-300' : 'text-purple-700'}`}>
                    Q: What about public players?
                  </p>
                  <p className={`text-base ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                    A: Public players will pay the regular play fee — but it's still small. This fee keeps the game's economy strong and fair.
                  </p>
                </div>

                <div className="space-y-2">
                  <p className={`text-base font-bold ${isDarkMode ? 'text-purple-300' : 'text-purple-700'}`}>
                    Q: What will we do with the collected fees?
                  </p>
                  <p className={`text-base ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                    A: The fees will be used to: Run multiple raffles for the community • Add to our project's liquidity for the upcoming token • Encourage more on-chain activity and transactions on InkChain
                  </p>
                </div>
              </div>

              <div className={`mt-4 p-4 rounded-lg border ${isDarkMode ? 'bg-purple-900/20 border-purple-700/50' : 'bg-purple-50 border-purple-200'}`}>
                <p className={`text-base font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                  This system isn't just about payments — it's about building a real, active community around Shellies and InkChain.
                </p>
                <p className={`text-base font-bold mt-2 ${isDarkMode ? 'text-purple-300' : 'text-purple-700'}`}>
                  Real players. Real rewards. Real growth.
                </p>
              </div>

              {/* NFT Holder Pricing Tiers */}
              <div className={`mt-6 p-5 rounded-xl border backdrop-blur-sm ${isDarkMode
                ? 'bg-gray-800/40 border-gray-700/50'
                : 'bg-white/60 border-gray-200'
                }`}>
                <div className="mb-4">
                  <h4 className={`text-lg font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Payment Categories
                  </h4>
                </div>

                {tiersLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className={`p-4 rounded-lg h-32 animate-pulse ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-200'}`} />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {paymentTiers.map((tier) => {
                      const tierName = tier.tier_name;
                      const minNfts = tier.min_nfts ?? 0;
                      const maxNfts = tier.max_nfts;
                      const ethAmount = parseFloat(formatEther(BigInt(tier.payment_amount_wei))).toFixed(8);

                      // Calculate discount percentage
                      const regularTier = paymentTiers.find(t => t.tier_name === 'regular');
                      const discountPercent = regularTier
                        ? Math.round((1 - parseFloat(tier.payment_amount_wei) / parseFloat(regularTier.payment_amount_wei)) * 100)
                        : 0;

                      // Determine if this card should show the Play button
                      // Priority: Staker > NFT Holder > Regular
                      const shouldShowPlayButton =
                        (tierName === 'staker' && userStakedCount > 0) ||
                        (tierName === 'nft_holder' && userNftCount > 0 && userStakedCount === 0) ||
                        (tierName === 'regular' && userNftCount === 0 && userStakedCount === 0);

                      // Uniform styling for all cards
                      const baseStyles = {
                        bgGradient: isDarkMode ? 'from-gray-800 to-gray-900' : 'from-white to-gray-50',
                        borderColor: isDarkMode ? 'border-gray-700' : 'border-gray-200',
                        accentColor: isDarkMode ? 'bg-purple-600' : 'bg-purple-500',
                        textColor: isDarkMode ? 'text-gray-300' : 'text-gray-700',
                        priceColor: isDarkMode ? 'text-white' : 'text-gray-900',
                        labelColor: isDarkMode ? 'text-gray-500' : 'text-gray-600',
                        badgeColor: isDarkMode ? 'bg-purple-600/20 text-purple-300 border-purple-500/30' : 'bg-purple-100 text-purple-700 border-purple-300',
                      };

                      // Active card gets special background
                      const activeStyles = shouldShowPlayButton ? {
                        bgGradient: isDarkMode
                          ? 'from-purple-900/40 to-pink-900/40'
                          : 'from-purple-50 to-pink-50',
                        borderColor: isDarkMode ? 'border-purple-600/50' : 'border-purple-300',
                      } : {};

                      const styles = { ...baseStyles, ...activeStyles };

                      return (
                        <div
                          key={tier.id}
                          className={`relative p-4 rounded-lg border bg-gradient-to-br ${styles.bgGradient} ${styles.borderColor} transition-all duration-200 hover:shadow-lg hover:scale-[1.02] overflow-hidden`}
                        >
                          {/* Accent bar */}
                          <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-lg ${styles.accentColor}`} />

                          {/* Tier name */}
                          <div className="relative flex items-center justify-between mb-3 mt-1">
                            <h5 className={`text-sm font-bold uppercase tracking-wide ${shouldShowPlayButton ? (isDarkMode ? 'text-purple-300' : 'text-purple-700') : styles.textColor}`}>
                              {tierName.replace('_', ' ')}
                            </h5>
                            {discountPercent > 0 && (
                              <span className={`px-2 py-0.5 rounded-md text-xs font-semibold border ${styles.badgeColor}`}>
                                -{discountPercent}%
                              </span>
                            )}
                          </div>

                          {/* User's NFT/Staked count - Only show for holder and staker */}
                          {tierName === 'nft_holder' && (
                            <div className="relative mb-3">
                              <p className={`text-xs font-medium uppercase tracking-wider ${styles.labelColor}`}>
                                Your NFTs
                              </p>
                              <p className={`text-lg font-bold ${shouldShowPlayButton ? (isDarkMode ? 'text-purple-200' : 'text-purple-800') : styles.textColor}`}>
                                {userNftCount} NFT{userNftCount !== 1 ? 's' : ''}
                              </p>
                            </div>
                          )}
                          {tierName === 'staker' && (
                            <div className="relative mb-3">
                              <p className={`text-xs font-medium uppercase tracking-wider ${styles.labelColor}`}>
                                Your Staked NFTs
                              </p>
                              <p className={`text-lg font-bold ${shouldShowPlayButton ? (isDarkMode ? 'text-purple-200' : 'text-purple-800') : styles.textColor}`}>
                                {userStakedCount} NFT{userStakedCount !== 1 ? 's' : ''}
                              </p>
                            </div>
                          )}

                          {/* Price in USD */}
                          <div className="relative mb-3">
                            <p className={`text-xs font-medium uppercase tracking-wider ${styles.labelColor}`}>
                              Price per Game
                            </p>
                            {ethPrice ? (
                              <>
                                <p className={`text-xl font-bold ${shouldShowPlayButton ? (isDarkMode ? 'text-purple-200' : 'text-purple-800') : styles.priceColor}`}>
                                  ${GamePaymentService.convertEthToUsd(BigInt(tier.payment_amount_wei), ethPrice).toFixed(4)}
                                </p>
                                <p className={`text-xs ${styles.labelColor}`}>
                                  ({parseFloat(ethAmount).toFixed(6)} ETH)
                                </p>
                              </>
                            ) : (
                              <p className={`text-sm ${styles.labelColor}`}>
                                Loading price...
                              </p>
                            )}
                          </div>

                          {/* Play Button - Shows on active tier */}
                          {shouldShowPlayButton && (
                            <button
                              onClick={() => {
                                // Scroll to game console instead of hiding description
                                const gameConsole = document.querySelector('.rounded-2xl.border.overflow-hidden');
                                if (gameConsole) {
                                  gameConsole.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }
                              }}
                              className={`relative w-full mt-2 py-2 px-4 rounded-lg font-bold text-white transition-all duration-200 hover:scale-105 shadow-lg ${tierName === 'staker'
                                ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700'
                                : tierName === 'nft_holder'
                                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
                                  : 'bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800'
                                }`}
                            >
                              🎮 Play Now
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              {/* Tier Discount Badge */}
              {(paymentTier === 'staker' || paymentTier === 'nft_holder') && (
                <div className={`mt-4 p-3 rounded-lg border ${paymentTier === 'staker'
                  ? isDarkMode
                    ? 'bg-gradient-to-r from-purple-900/30 to-pink-900/30 border-purple-700/50'
                    : 'bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200'
                  : isDarkMode
                    ? 'bg-gradient-to-r from-blue-900/30 to-indigo-900/30 border-blue-700/50'
                    : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200'
                  }`}>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">
                      {paymentTier === 'staker' ? '🔒' : '🎨'}
                    </span>
                    <div className="flex-1">
                      <p className={`text-sm font-bold capitalize ${paymentTier === 'staker'
                        ? isDarkMode ? 'text-purple-300' : 'text-purple-700'
                        : isDarkMode ? 'text-blue-300' : 'text-blue-700'
                        }`}>
                        {paymentTier === 'staker' ? 'Staker' : 'NFT Holder'} Tier Active!
                      </p>
                      <p className={`text-xs ${paymentTier === 'staker'
                        ? isDarkMode ? 'text-purple-400' : 'text-purple-600'
                        : isDarkMode ? 'text-blue-400' : 'text-blue-600'
                        }`}>
                        {paymentTier === 'staker'
                          ? 'You have staked NFTs - Enjoy maximum discount! 🎉'
                          : `You own ${nftCount} Shellies NFT${nftCount > 1 ? 's' : ''} - Enjoy your discount! 🎉`
                        }
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${paymentTier === 'staker'
                      ? isDarkMode ? 'bg-purple-700 text-purple-100' : 'bg-purple-500 text-white'
                      : isDarkMode ? 'bg-blue-700 text-blue-100' : 'bg-blue-500 text-white'
                      }`}>
                      {paymentTier === 'staker' ? '80%' : '50%'} OFF
                    </span>
                  </div>
                </div>
              )}

              {/* Payment Amount Display */}
              <div className={`mt-4 pt-4 border-t flex items-center justify-between flex-wrap gap-3 ${isDarkMode ? 'border-purple-700/50' : 'border-purple-200'
                }`}>
                <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Cost per game:
                </span>
                <div className="flex items-center gap-3">
                  {ethPrice && requiredEth > BigInt(0) ? (
                    <>
                      <span className={`text-lg font-bold ${isNFTHolder
                        ? isDarkMode ? 'text-green-300' : 'text-green-600'
                        : isDarkMode ? 'text-white' : 'text-gray-900'
                        }`}>
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
          onClose={() => setShowPaymentOverlay(false)}
        />


      </div>
    </div>
  );
}
