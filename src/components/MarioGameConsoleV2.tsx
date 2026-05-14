'use client';

import { useState, useRef, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Gamepad2, Trophy, X, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { useGameScore } from '@/hooks/useGameScore';
import { useTheme } from '@/contexts/ThemeContext';
import { useGamePayment } from '@/hooks/useGamePayment';
import { useNFTAnalytics } from '@/hooks/useNFTAnalytics';
import { useWriteContract, useAccount, useSwitchChain } from 'wagmi';
import { formatEther } from 'viem';
import { GamePaymentService } from '@/lib/contracts';
import { WalletRequired } from '@/components/portal/WalletRequired';
import PaymentLoadingOverlay from './PaymentLoadingOverlay';
import { inkChain } from '@/lib/wagmi';

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
  const { chain, chainId: accountChainId, connector } = useAccount();
  const { switchChain } = useSwitchChain();

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
  const [isWrongNetwork, setIsWrongNetwork] = useState(false);
  const [actualChainName, setActualChainName] = useState<string>('Unknown Network');

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

  // Monitor network changes - updates whenever user switches network in wallet
  // IMPORTANT: Use connector to get actual chain ID, not chain object
  // When connected to unsupported chain, chain object may be undefined but connector has the real chainId
  useEffect(() => {
    const checkNetwork = async () => {
      if (!connector) {
        setIsWrongNetwork(false);
        return;
      }

      try {
        // Get the actual chain ID from the connector's provider
        const provider = await connector.getProvider() as any;
        if (provider && typeof provider.request === 'function') {
          const chainIdHex = await provider.request({ method: 'eth_chainId' }) as string;
          const actualChainId = parseInt(chainIdHex, 16);
          
          const wrongNetwork = actualChainId !== inkChain.id;
          setIsWrongNetwork(wrongNetwork);
          
          // Determine chain name
          let chainName = 'Unknown Network';
          if (chain && chain.id === actualChainId) {
            chainName = chain.name;
          } else {
            // Common chain names for better UX
            const knownChains: Record<number, string> = {
              1: 'Ethereum Mainnet',
              8453: 'Base',
              10: 'Optimism',
              42161: 'Arbitrum One',
              137: 'Polygon',
              56: 'BNB Chain',
              43114: 'Avalanche',
              250: 'Fantom',
              57073: 'Ink Chain'
            };
            chainName = knownChains[actualChainId] || `Chain ${actualChainId}`;
          }
          setActualChainName(chainName);
          
          console.log('🔍 Network check:', {
            actualChainId,
            chainName,
            expectedChainId: inkChain.id,
            isWrongNetwork: wrongNetwork,
            chainFromUseAccount: chain?.id,
            chainIdFromUseAccount: accountChainId
          });
          
          if (wrongNetwork) {
            console.warn('❌ Wrong network detected:', {
              actualChainId,
              chainName,
              expectedChainId: inkChain.id
            });
          } else {
            console.log('✅ Correct network detected: Ink Chain');
          }
        }
      } catch (error) {
        console.error('Error checking network:', error);
        // Fallback to chain object if provider check fails
        if (chain) {
          const wrongNetwork = chain.id !== inkChain.id;
          setIsWrongNetwork(wrongNetwork);
          setActualChainName(chain.name);
        }
      }
    };

    checkNetwork();
  }, [connector, chain, accountChainId]);

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
    // Get actual chain ID from connector
    let actualChainId: number | undefined;
    
    if (connector) {
      try {
        const provider = await connector.getProvider() as any;
        if (provider && typeof provider.request === 'function') {
          const chainIdHex = await provider.request({ method: 'eth_chainId' }) as string;
          actualChainId = parseInt(chainIdHex, 16);
        }
      } catch (error) {
        console.error('Error getting chain ID from connector:', error);
        actualChainId = chain?.id;
      }
    } else {
      actualChainId = chain?.id;
    }
    
    console.log('🎮 Payment initiation requested:', {
      action,
      actualChainId,
      expectedChainId: inkChain.id,
      isCorrectNetwork: actualChainId === inkChain.id
    });
    
    // Check if user is on the correct network using actual chain ID
    if (actualChainId !== inkChain.id) {
      console.error('❌ Payment blocked at component level - wrong network');
      setIsWrongNetwork(true);
      setShowPaymentOverlay(true);
      setPaymentStatus('error');
      return;
    }

    console.log('✅ Network check passed at component level, proceeding with payment...');
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
    return <WalletRequired variant="card" isDarkMode={isDarkMode}
            title="Connect your wallet"
            action="connect to play the Shellies game and earn XP" />;
  }

  // Collapsible FAQ state
  const [faqOpen, setFaqOpen] = useState(true);

  // Show skeleton loader while loading score
  if (scoreLoading) {
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

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <Gamepad2 className={`w-5 h-5 ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`} />
          <h1 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Shellies Game
          </h1>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${isDarkMode ? 'bg-gray-800 text-gray-300' : 'bg-white text-gray-700 shadow-sm'}`}>
          <Trophy className="w-4 h-4 text-yellow-500" />
          <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{bestScore}</span>
          <span className={isDarkMode ? 'text-gray-500' : 'text-gray-400'}>XP</span>
        </div>
      </div>

      {/* Wrong Network Warning */}
      {isWrongNetwork && (
        <div className={`rounded-lg border px-4 py-3 flex items-center gap-3 flex-wrap ${isDarkMode ? 'bg-red-950/40 border-red-800/60 text-red-300' : 'bg-red-50 border-red-200 text-red-700'}`}>
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <p className="text-sm flex-1">
            Connected to <span className="font-medium">{actualChainName}</span>. Switch to Ink Chain to play.
          </p>
          <button
            onClick={() => switchChain?.({ chainId: inkChain.id })}
            className="px-3 py-1.5 text-sm font-medium rounded-md bg-red-600 hover:bg-red-700 text-white transition-colors"
          >
            Switch Network
          </button>
        </div>
      )}

      {/* Pricing + Info banner */}
      {showPaymentInfo && (
        <div className={`rounded-lg border ${isDarkMode ? 'bg-gray-800/60 border-gray-700' : 'bg-white border-gray-200 shadow-sm'}`}>
          {/* Top bar: your price + tier badge + dismiss */}
          <div className="px-4 py-3 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Cost per game:</span>
              {ethPrice && requiredEth > BigInt(0) ? (
                <span className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  ${GamePaymentService.convertEthToUsd(requiredEth, ethPrice).toFixed(4)}
                  <span className={`font-normal ml-1.5 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    ({parseFloat(formatEther(requiredEth)).toFixed(6)} ETH)
                  </span>
                </span>
              ) : (
                <span className={`text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>Loading...</span>
              )}
              {(paymentTier === 'staker' || paymentTier === 'nft_holder') && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${paymentTier === 'staker'
                  ? isDarkMode ? 'bg-purple-900/60 text-purple-300' : 'bg-purple-100 text-purple-700'
                  : isDarkMode ? 'bg-blue-900/60 text-blue-300' : 'bg-blue-100 text-blue-700'
                }`}>
                  {paymentTier === 'staker' ? 'Staker' : 'Holder'} — {paymentTier === 'staker' ? '80' : '50'}% off
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setFaqOpen(!faqOpen)}
                className={`p-1.5 rounded-md text-xs flex items-center gap-1 transition-colors ${isDarkMode ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
              >
                {faqOpen ? 'Less' : 'More'}
                {faqOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => {
                  setShowPaymentInfo(false);
                  if (typeof window !== 'undefined') {
                    localStorage.setItem('hidePaymentInfoBanner', 'true');
                  }
                }}
                className={`p-1.5 rounded-md transition-colors ${isDarkMode ? 'text-gray-500 hover:text-gray-300 hover:bg-gray-700' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
                aria-label="Close payment information"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Expanded: tiers + FAQ */}
          {faqOpen && (
            <div className={`border-t px-4 py-4 space-y-4 ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
              {/* Tier cards */}
              <div>
                <h4 className={`text-sm font-medium mb-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Pricing tiers</h4>
                {tiersLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className={`h-20 rounded-lg animate-pulse ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-100'}`} />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {paymentTiers.map((tier) => {
                      const tierName = tier.tier_name;
                      const ethAmount = parseFloat(formatEther(BigInt(tier.payment_amount_wei)));
                      const regularTier = paymentTiers.find(t => t.tier_name === 'regular');
                      const discountPercent = regularTier
                        ? Math.round((1 - parseFloat(tier.payment_amount_wei) / parseFloat(regularTier.payment_amount_wei)) * 100)
                        : 0;
                      const isActive =
                        (tierName === 'staker' && userStakedCount > 0) ||
                        (tierName === 'nft_holder' && userNftCount > 0 && userStakedCount === 0) ||
                        (tierName === 'regular' && userNftCount === 0 && userStakedCount === 0);

                      return (
                        <div
                          key={tier.id}
                          className={`rounded-lg border px-3 py-2.5 ${isActive
                            ? isDarkMode ? 'border-purple-600/60 bg-purple-950/30' : 'border-purple-300 bg-purple-50/60'
                            : isDarkMode ? 'border-gray-700 bg-gray-800/40' : 'border-gray-200 bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-xs font-semibold uppercase tracking-wide ${isActive
                              ? isDarkMode ? 'text-purple-300' : 'text-purple-700'
                              : isDarkMode ? 'text-gray-400' : 'text-gray-500'
                            }`}>
                              {tierName.replace('_', ' ')}
                            </span>
                            {discountPercent > 0 && (
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${isDarkMode ? 'bg-green-900/40 text-green-400' : 'bg-green-100 text-green-700'}`}>
                                -{discountPercent}%
                              </span>
                            )}
                            {isActive && (
                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${isDarkMode ? 'bg-purple-800/50 text-purple-300' : 'bg-purple-100 text-purple-600'}`}>
                                Your tier
                              </span>
                            )}
                          </div>
                          <div className="flex items-baseline gap-1.5">
                            {ethPrice ? (
                              <>
                                <span className={`text-base font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                  ${GamePaymentService.convertEthToUsd(BigInt(tier.payment_amount_wei), ethPrice).toFixed(4)}
                                </span>
                                <span className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                  {ethAmount.toFixed(6)} ETH
                                </span>
                              </>
                            ) : (
                              <span className={`text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>Loading...</span>
                            )}
                          </div>
                          {tierName === 'nft_holder' && userNftCount > 0 && (
                            <p className={`text-[11px] mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                              You hold {userNftCount} NFT{userNftCount !== 1 ? 's' : ''}
                            </p>
                          )}
                          {tierName === 'staker' && userStakedCount > 0 && (
                            <p className={`text-[11px] mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                              You have {userStakedCount} staked
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* FAQ */}
              <div>
                <h4 className={`text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>FAQ</h4>
                <div className={`text-sm space-y-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  <p><span className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>Why is there a play fee?</span> It prevents bots and keeps gameplay fair for real players.</p>
                  <p><span className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>Do holders pay less?</span> Yes — NFT holders get 50% off and stakers get 80% off.</p>
                  <p><span className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>Where do fees go?</span> Community raffles, project liquidity, and on-chain activity on InkChain.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Game Console */}
      <div className={`rounded-xl border overflow-hidden ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 shadow-sm'}`}>
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
          errorMessage={isWrongNetwork
            ? `Wrong network detected. You are on ${chain?.name || 'Unknown Network'}. Please switch to Ink Chain to continue.`
            : paymentError
          }
          canRetry={isWrongNetwork || canRetryPayment}
          onRetry={isWrongNetwork
            ? () => switchChain?.({ chainId: inkChain.id })
            : handleRetryPayment
          }
          retryButtonText={isWrongNetwork ? 'Switch to Ink Chain' : undefined}
          onClose={() => {
            setShowPaymentOverlay(false);
            if (isWrongNetwork) {
              setIsWrongNetwork(false);
            }
          }}
        />

        {/* Controls bar */}
        <div className={`px-4 py-3 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
          <div className="flex items-center gap-4 flex-wrap">
            <span className={`text-xs font-medium ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>Controls:</span>
            {[
              { key: 'Arrows', action: 'Move' },
              { key: 'Space', action: 'Jump' },
              { key: 'Shift', action: 'Run' },
              { key: 'Ctrl', action: 'Fire' },
            ].map(({ key, action }) => (
              <div key={key} className="flex items-center gap-1.5">
                <kbd className={`text-[11px] font-mono px-1.5 py-0.5 rounded ${isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>{key}</kbd>
                <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{action}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
