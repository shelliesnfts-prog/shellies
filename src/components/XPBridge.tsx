'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '@/contexts/ThemeContext';
import { parseConversionError } from '@/lib/errors';
import ErrorDisplay from '@/components/ErrorDisplay';
import { logger, logConversionError } from '@/lib/logger';
import { Clock } from 'lucide-react';

/**
 * Conversion rate constant: 1000 XP = 100 points (divide by 10)
 */
const CONVERSION_RATE = 10;

/**
 * Props for XPBridge component
 */
interface XPBridgeProps {
  currentXP: number;
  currentPoints: number;
  onConversionComplete: (newXP: number, newPoints: number) => void;
}

/**
 * XPBridge Component
 * 
 * Allows users to convert their game XP to raffle points with the following features:
 * - Displays current XP and points balances
 * - Shows conversion rate (1000 XP = 100 points)
 * - Real-time calculation as user types
 * - Input validation (sufficient balance, positive integer)
 * - Calls /api/bridge/convert-xp endpoint
 * - Handles success/error responses
 * - Styled with gradient background and responsive design
 */
export default function XPBridge({
  currentXP,
  currentPoints,
  onConversionComplete,
}: XPBridgeProps) {
  const { address, isConnected } = useAccount();
  const { isDarkMode } = useTheme();

  // Component state
  const [isConverting, setIsConverting] = useState<boolean>(false);
  const [conversionError, setConversionError] = useState<string | null>(null);
  const [canRetryConversion, setCanRetryConversion] = useState<boolean>(true);
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [canConvert, setCanConvert] = useState<boolean>(true);
  const [secondsUntilNextConvert, setSecondsUntilNextConvert] = useState<number>(0);
  const [loadingStatus, setLoadingStatus] = useState<boolean>(false);

  // Calculate points that will be received
  const calculatedPoints = currentXP / CONVERSION_RATE;

  // Fetch conversion status on mount and when address changes
  useEffect(() => {
    const fetchConversionStatus = async () => {
      if (!address || !isConnected) {
        setCanConvert(true);
        setSecondsUntilNextConvert(0);
        return;
      }

      try {
        setLoadingStatus(true);
        const response = await fetch(`/api/bridge/convert-xp?walletAddress=${address}`);
        const data = await response.json();

        if (response.ok) {
          setCanConvert(data.canConvert);
          setSecondsUntilNextConvert(data.secondsUntilNextConvert || 0);
        }
      } catch (error) {
        console.error('Failed to fetch conversion status:', error);
      } finally {
        setLoadingStatus(false);
      }
    };

    fetchConversionStatus();
  }, [address, isConnected]);

  // Countdown timer effect
  useEffect(() => {
    if (secondsUntilNextConvert <= 0) {
      setCanConvert(true);
      return;
    }

    const interval = setInterval(() => {
      setSecondsUntilNextConvert((prev) => {
        if (prev <= 1) {
          setCanConvert(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [secondsUntilNextConvert]);

  // Format countdown display
  const formatCountdown = (seconds: number): string => {
    const days = Math.floor(seconds / (24 * 60 * 60));
    const hours = Math.floor((seconds % (24 * 60 * 60)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  /**
   * Handle conversion by calling the API endpoint with comprehensive error handling
   */
  const handleConvert = async () => {
    // Validate wallet connection
    if (!address || !isConnected) {
      setConversionError('Please connect your wallet first');
      setCanRetryConversion(false);
      return;
    }

    // Validate XP amount
    if (currentXP <= 0) {
      setConversionError('You have no XP to convert');
      setCanRetryConversion(false);
      return;
    }

    const xpAmount = currentXP; // Convert all XP

    setIsConverting(true);
    setConversionError(null);
    setCanRetryConversion(true);
    setShowSuccess(false);

    try {
      const response = await fetch('/api/bridge/convert-xp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: address,
          xpAmount: xpAmount,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Parse error response for user-friendly message
        const errorMessage = data.error || data.message || 'Conversion failed';
        const parsedError = parseConversionError({ message: errorMessage });

        setConversionError(parsedError.message);
        setCanRetryConversion(parsedError.canRetry);

        // Log detailed error for debugging
        logConversionError({ message: errorMessage }, {
          action: 'convertXP',
          status: response.status,
          code: parsedError.code,
          canRetry: parsedError.canRetry,
          walletAddress: address,
          xpAmount
        });

        return;
      }

      // Handle success response
      if (data.success) {
        // Log successful conversion
        logger.conversion('XP converted successfully', {
          walletAddress: address,
          xpAmount,
          pointsAdded: data.data.pointsAdded,
          newXP: data.data.newXP,
          newPoints: data.data.newPoints
        });

        // Call the callback with updated balances
        onConversionComplete(data.data.newXP, data.data.newPoints);

        // Show success message
        setShowSuccess(true);
        
        // Reset conversion status - user must wait 7 days
        setCanConvert(false);
        setSecondsUntilNextConvert(7 * 24 * 60 * 60); // 7 days in seconds

        // Reset state after showing success
        setTimeout(() => {
          setConversionError(null);
          setShowSuccess(false);
        }, 3000);
      } else {
        const parsedError = parseConversionError({ message: data.error || 'Conversion failed' });
        setConversionError(parsedError.message);
        setCanRetryConversion(parsedError.canRetry);
      }
    } catch (error) {
      // Parse network/fetch errors
      const parsedError = parseConversionError(error);
      setConversionError(parsedError.message);
      setCanRetryConversion(parsedError.canRetry);

      // Log network/fetch errors
      logConversionError(error, {
        action: 'convertXP',
        code: parsedError.code,
        canRetry: parsedError.canRetry,
        walletAddress: address,
        xpAmount
      });
    } finally {
      setIsConverting(false);
    }
  };

  /**
   * Retry conversion after error
   */
  const handleRetryConversion = async () => {
    setConversionError(null);
    await handleConvert();
  };

  /**
   * Check if convert button should be disabled
   */
  const isConvertDisabled = (): boolean => {
    if (!isConnected || !address) return true;
    if (isConverting || loadingStatus) return true;
    if (currentXP <= 0) return true;
    if (!canConvert) return true;

    return false;
  };

  return (
    <div className={`h-full group relative overflow-hidden rounded-2xl border transition-all duration-300 hover:shadow-lg ${isDarkMode
      ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
      : 'bg-gradient-to-br from-white to-gray-50 border-gray-200'
      }`}>
      {/* Fire Animation Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-pink-500/5 to-transparent" />
        {/* Animated fire glow effect */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-orange-500/30 via-red-500/20 to-transparent rounded-full blur-3xl animate-pulse" 
             style={{ animationDuration: '2s' }} />
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-gradient-to-br from-yellow-500/30 via-orange-500/20 to-transparent rounded-full blur-3xl animate-pulse" 
             style={{ animationDuration: '3s', animationDelay: '0.5s' }} />
        {/* Floating fire particles */}
        <div className="absolute top-1/4 right-1/4 w-2 h-2 bg-orange-400 rounded-full animate-ping" 
             style={{ animationDuration: '2s' }} />
        <div className="absolute bottom-1/3 left-1/3 w-2 h-2 bg-red-400 rounded-full animate-ping" 
             style={{ animationDuration: '2.5s', animationDelay: '0.3s' }} />
        <div className="absolute top-1/2 left-1/2 w-2 h-2 bg-yellow-400 rounded-full animate-ping" 
             style={{ animationDuration: '3s', animationDelay: '0.7s' }} />
      </div>
      <div className="relative p-6 h-full flex flex-col">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className={`text-sm font-semibold mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              XP Converter
            </h3>
            <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Convert XP to points • Rate: 10 XP = 1 Point
            </p>
          </div>
          <div className={`p-2.5 rounded-xl ${isDarkMode ? 'bg-gradient-to-br from-purple-500/20 to-pink-500/20' : 'bg-gradient-to-br from-purple-100 to-pink-100'
            }`}>
            <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </div>
        </div>
        
        <div className="space-y-3 flex-1 flex flex-col">
          {loadingStatus ? (
            <div className="space-y-3 flex-1 flex flex-col justify-between">
              <div className={`h-3 rounded animate-pulse w-full ${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'}`}></div>
              <div className={`h-10 rounded-lg animate-pulse w-full ${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'}`}></div>
            </div>
          ) : (
            <>
              {/* Balance Info */}
              <div className="space-y-2 flex-1">
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Available: {currentXP.toLocaleString()} XP
                  </span>
                  <div className={`flex items-center space-x-1 text-xs ${canConvert && currentXP > 0
                    ? 'text-green-600'
                    : isDarkMode ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                    <div className={`w-1.5 h-1.5 rounded-full mr-2 ${canConvert && currentXP > 0 ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                      }`} />
                    {canConvert && currentXP > 0 ? 'Ready to convert' : !canConvert ? 'On cooldown' : 'No XP available'}
                  </div>
                </div>
                
                {/* Cooldown Timer */}
                {!canConvert && secondsUntilNextConvert > 0 && (
                  <div className={`text-xs flex items-center gap-1 ${isDarkMode ? 'text-yellow-400' : 'text-yellow-700'}`}>
                    <Clock className="w-3 h-3" />
                    <span>Next conversion in: {formatCountdown(secondsUntilNextConvert)}</span>
                  </div>
                )}
              </div>

              {/* Convert Button Wrapper */}
              <div className={`rounded-xl p-6 border relative overflow-hidden ${isDarkMode 
                ? 'bg-white/5 backdrop-blur-md border-white/10' 
                : 'bg-white/50 backdrop-blur-md border-gray-200/50'
              }`}>
                {/* Fire shimmer effect on button container */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-orange-500/10 to-transparent animate-shimmer" 
                     style={{ 
                       backgroundSize: '200% 100%',
                       animation: 'shimmer 3s infinite'
                     }} />
                
                <button
                  onClick={() => {
                    // Show coming soon message
                    setConversionError('🔥 Coming Soon! This feature is being prepared for launch.');
                    setCanRetryConversion(false);
                    setTimeout(() => setConversionError(null), 3000);
                  }}
                  className={`relative w-full px-4 py-3 rounded-lg font-medium transition-all duration-200 transform ${isDarkMode
                    ? 'bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 border border-orange-500/50'
                    : 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 border border-orange-400/50'
                    } text-white shadow-lg hover:scale-105 hover:shadow-orange-500/50`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-xl animate-bounce" style={{ animationDuration: '1s' }}>🔥</span>
                    <span className="font-bold">Coming Soon</span>
                    <span className="text-xl animate-bounce" style={{ animationDuration: '1s', animationDelay: '0.2s' }}>🔥</span>
                  </div>
                </button>
                
                <div className={`text-xs mt-3 text-center font-medium ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`}>
                  🚀 New feature launching soon! Stay tuned.
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Error Message */}
      {conversionError && (
        <div className="mt-3">
          <ErrorDisplay
            message={conversionError}
            severity="error"
            onRetry={canRetryConversion ? handleRetryConversion : undefined}
            canRetry={canRetryConversion}
          />
        </div>
      )}

      {/* Success Message */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className={`mt-3 rounded-lg p-3 border transition-colors duration-300 ${isDarkMode
              ? 'bg-green-900/20 border-green-500/30'
              : 'bg-green-50 border-green-200'
              }`}
          >
            <div className="flex items-center justify-center gap-2">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              >
                <svg className={`w-5 h-5 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </motion.div>
              <p className={`text-xs font-semibold ${isDarkMode ? 'text-green-400' : 'text-green-700'}`}>
                Conversion successful!
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Wallet Connection Info */}
      {!isConnected && (
        <div className={`mt-3 rounded-lg p-3 border transition-colors duration-300 ${isDarkMode
          ? 'bg-yellow-900/20 border-yellow-500/30'
          : 'bg-yellow-50 border-yellow-200'
          }`}>
          <p className={`text-xs text-center ${isDarkMode ? 'text-yellow-400' : 'text-yellow-800'}`}>
            Please connect your wallet to convert XP
          </p>
        </div>
      )}
    </div>
  );
}
