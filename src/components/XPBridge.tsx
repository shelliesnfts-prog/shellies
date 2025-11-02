'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '@/contexts/ThemeContext';
import { parseConversionError } from '@/lib/errors';
import ErrorDisplay from '@/components/ErrorDisplay';
import { logger, logConversionError } from '@/lib/logger';

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

  // Calculate points that will be received
  const calculatedPoints = currentXP / CONVERSION_RATE;

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
    if (isConverting) return true;
    if (currentXP <= 0) return true;

    return false;
  };

  return (
    <div className={`w-full rounded-xl p-4 border shadow-md transition-colors duration-300 ${isDarkMode
      ? 'bg-gradient-to-br from-gray-800 via-gray-900 to-gray-800 border-gray-700'
      : 'bg-gradient-to-br from-purple-50 via-pink-50 to-purple-50 border-purple-200'
      }`}>
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-1">
          XP Bridge
        </h3>
        <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          Convert all your XP to points • Rate: 10 XP = 1 Point
        </p>
      </div>

      {/* Main Content - Horizontal Layout */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* Balance Info */}
        <div className={`flex-1 rounded-lg p-3 border transition-colors duration-300 ${isDarkMode
          ? 'bg-gray-800/50 border-gray-700'
          : 'bg-white/50 border-gray-200'
          }`}>
          <div className="flex items-center justify-between text-sm">
            <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Current XP:</span>
            <span className={`font-bold ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}>
              {currentXP.toLocaleString()}
            </span>
          </div>
          {currentXP > 0 && (
            <div className="flex items-center justify-between text-sm mt-2 pt-2 border-t border-gray-700/50">
              <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>You will receive:</span>
              <span className={`font-bold ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                {calculatedPoints.toLocaleString()} points
              </span>
            </div>
          )}
        </div>

        {/* Convert Button */}
        <button
          onClick={handleConvert}
          disabled={isConvertDisabled()}
          className={`w-full sm:w-auto px-6 py-3 rounded-lg font-semibold text-white transition-all duration-200 whitespace-nowrap ${isConvertDisabled()
            ? isDarkMode
              ? 'bg-gray-700 cursor-not-allowed text-gray-500'
              : 'bg-gray-300 cursor-not-allowed'
            : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg hover:shadow-xl transform hover:scale-[1.02]'
            }`}
        >
          {isConverting ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Converting...
            </span>
          ) : (
            'Convert All'
          )}
        </button>
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
