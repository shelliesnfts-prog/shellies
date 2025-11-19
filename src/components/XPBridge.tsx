'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '@/contexts/ThemeContext';
import { parseConversionError } from '@/lib/errors';
import ErrorDisplay from '@/components/ErrorDisplay';
import { logger, logConversionError } from '@/lib/logger';
import { AlertTriangle } from 'lucide-react';
import { PriceOracle } from '@/lib/price-oracle';
import { payForXPConversion, getTransactionTimestamp } from '@/lib/game-payment-service';

/**
 * Conversion rate constant: 1000 XP = 100 points (divide by 10)
 */
const CONVERSION_RATE = 10;

/**
 * Payment amount in USD
 */
const PAYMENT_AMOUNT_USD = 0.1;

/**
 * Minimum XP required to convert
 */
const MINIMUM_XP = 100;

/**
 * localStorage key for pending conversion
 */
const PENDING_CONVERSION_KEY = 'pendingConversionTx';

/**
 * Max age for pending conversion (24 hours)
 */
const MAX_PENDING_AGE = 24 * 60 * 60 * 1000;

/**
 * Pending conversion interface
 */
interface PendingConversion {
  txHash: string;
  timestamp: number;
  xpAmount: number;
  paymentAmount: number;
  createdAt: number;
}

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
 * Allows users to convert their game XP to raffle points by paying 0.1 USD
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
  const [isPaymentPending, setIsPaymentPending] = useState<boolean>(false);
  const [conversionError, setConversionError] = useState<string | null>(null);
  const [canRetryConversion, setCanRetryConversion] = useState<boolean>(true);
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [ethPrice, setEthPrice] = useState<number>(0);
  const [loadingPrice, setLoadingPrice] = useState<boolean>(true);
  
  // Recovery mechanism state
  const [pendingConversion, setPendingConversion] = useState<PendingConversion | null>(null);
  const [showResumeConversion, setShowResumeConversion] = useState<boolean>(false);
  const [isCheckingPending, setIsCheckingPending] = useState<boolean>(true);

  // Calculate points that will be received
  const calculatedPoints = currentXP / CONVERSION_RATE;
  const ethAmount = ethPrice > 0 ? PAYMENT_AMOUNT_USD / ethPrice : 0;

  // Fetch ETH price on mount
  useEffect(() => {
    const fetchEthPrice = async () => {
      try {
        setLoadingPrice(true);
        const price = await PriceOracle.getEthPrice();
        setEthPrice(price);
      } catch (error) {
        console.error('Failed to fetch ETH price:', error);
        setEthPrice(3000); // Fallback price
      } finally {
        setLoadingPrice(false);
      }
    };

    fetchEthPrice();
    // Refresh price every 5 minutes
    const interval = setInterval(fetchEthPrice, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Check for pending conversion on mount
  useEffect(() => {
    const checkPendingConversion = async () => {
      if (!address || !isConnected) {
        setIsCheckingPending(false);
        return;
      }

      try {
        // Check localStorage for pending conversion
        const pendingStr = localStorage.getItem(PENDING_CONVERSION_KEY);
        if (!pendingStr) {
          setIsCheckingPending(false);
          return;
        }

        const pending: PendingConversion = JSON.parse(pendingStr);

        // Check if too old (>24 hours)
        if (Date.now() - pending.createdAt > MAX_PENDING_AGE) {
          localStorage.removeItem(PENDING_CONVERSION_KEY);
          setIsCheckingPending(false);
          return;
        }

        // Fetch user's last_convert from API
        const response = await fetch('/api/bridge/convert-xp/status');
        if (!response.ok) {
          console.error('Failed to check conversion status');
          setIsCheckingPending(false);
          return;
        }

        const data = await response.json();
        const lastConvertTime = data.lastConvert 
          ? new Date(data.lastConvert).getTime() 
          : 0;
        const pendingTxTime = pending.timestamp * 1000;

        // Compare timestamps (same logic as server)
        if (pendingTxTime > lastConvertTime) {
          // Transaction was NOT processed yet
          setPendingConversion(pending);
          setShowResumeConversion(true);
        } else {
          // Transaction was already processed
          localStorage.removeItem(PENDING_CONVERSION_KEY);
        }
      } catch (error) {
        console.error('Error checking pending conversion:', error);
      } finally {
        setIsCheckingPending(false);
      }
    };

    checkPendingConversion();
  }, [address, isConnected]);

  /**
   * Save pending conversion to localStorage
   */
  const savePendingConversion = (
    txHash: string,
    timestamp: number,
    xpAmount: number,
    paymentAmount: number
  ) => {
    try {
      const pending: PendingConversion = {
        txHash,
        timestamp,
        xpAmount,
        paymentAmount,
        createdAt: Date.now()
      };
      localStorage.setItem(PENDING_CONVERSION_KEY, JSON.stringify(pending));
    } catch (error) {
      console.error('Failed to save pending conversion:', error);
    }
  };

  /**
   * Handle conversion by paying and calling API
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

    // Validate minimum XP requirement
    if (currentXP < MINIMUM_XP) {
      setConversionError(`Minimum ${MINIMUM_XP} XP required to convert. You have ${currentXP} XP.`);
      setCanRetryConversion(false);
      return;
    }

    // Validate ETH price loaded
    if (ethPrice <= 0) {
      setConversionError('Loading ETH price... Please try again');
      setCanRetryConversion(true);
      return;
    }

    const xpAmount = currentXP; // Convert all XP

    setIsConverting(true);
    setIsPaymentPending(true);
    setConversionError(null);
    setCanRetryConversion(true);
    setShowSuccess(false);

    try {
      // Step 1: Pay for conversion
      logger.conversion('Initiating payment for XP conversion', {
        walletAddress: address,
        xpAmount,
        paymentAmount: PAYMENT_AMOUNT_USD,
        ethAmount,
        ethPrice
      });

      const txHash = await payForXPConversion(PAYMENT_AMOUNT_USD, ethPrice);

      logger.conversion('Payment transaction confirmed', {
        walletAddress: address,
        txHash
      });

      // Step 2: Get transaction timestamp
      const txTimestamp = await getTransactionTimestamp(txHash);

      // Step 3: Save to localStorage
      savePendingConversion(txHash, txTimestamp, xpAmount, PAYMENT_AMOUNT_USD);

      setIsPaymentPending(false);

      // Step 4: Call API to convert XP
      const response = await fetch('/api/bridge/convert-xp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          xpAmount,
          txHash
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Parse error response
        const errorMessage = data.error || data.message || 'Conversion failed';
        const parsedError = parseConversionError({ message: errorMessage });

        setConversionError(parsedError.message);
        setCanRetryConversion(parsedError.canRetry);

        logConversionError({ message: errorMessage }, {
          action: 'convertXP',
          status: response.status,
          code: parsedError.code,
          canRetry: parsedError.canRetry,
          walletAddress: address,
          xpAmount,
          txHash
        });

        return;
      }

      // Success! Clear localStorage
      localStorage.removeItem(PENDING_CONVERSION_KEY);

      logger.conversion('XP converted successfully', {
        walletAddress: address,
        xpAmount,
        pointsAdded: data.data.pointsAdded,
        newXP: data.data.newXP,
        newPoints: data.data.newPoints,
        txHash
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

    } catch (error: any) {
      console.error('Conversion error:', error);

      // Check if error is from payment transaction
      if (isPaymentPending) {
        setConversionError(
          error.message || 'Payment transaction failed. Please try again.'
        );
        setCanRetryConversion(true);
      } else {
        // Error after payment - show recovery message
        setConversionError(
          'Payment successful but conversion failed. Your payment is saved - refresh the page to resume.'
        );
        setCanRetryConversion(false);
      }

      logConversionError(error, {
        action: 'convertXP',
        walletAddress: address,
        xpAmount: currentXP,
        isPaymentPending
      });
    } finally {
      setIsConverting(false);
      setIsPaymentPending(false);
    }
  };

  /**
   * Resume conversion with existing payment
   */
  const resumeConversion = async (pending: PendingConversion) => {
    setIsConverting(true);
    setConversionError(null);

    try {
      const response = await fetch('/api/bridge/convert-xp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          xpAmount: pending.xpAmount,
          txHash: pending.txHash
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Conversion failed');
      }

      // Success! Clear localStorage
      localStorage.removeItem(PENDING_CONVERSION_KEY);

      // Update UI
      onConversionComplete(data.data.newXP, data.data.newPoints);
      setShowSuccess(true);
      setShowResumeConversion(false);
      setPendingConversion(null);

      setTimeout(() => {
        setShowSuccess(false);
      }, 3000);

    } catch (error: any) {
      console.error('Resume conversion error:', error);
      setConversionError(error.message || 'Failed to resume conversion');
    } finally {
      setIsConverting(false);
    }
  };

  /**
   * Dismiss pending conversion
   */
  const dismissPendingConversion = () => {
    localStorage.removeItem(PENDING_CONVERSION_KEY);
    setPendingConversion(null);
    setShowResumeConversion(false);
  };

  /**
   * Check if convert button should be disabled
   */
  const isConvertDisabled = (): boolean => {
    if (!isConnected || !address) return true;
    if (isConverting || isPaymentPending || loadingPrice) return true;
    if (currentXP < MINIMUM_XP) return true;
    if (ethPrice <= 0) return true;
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
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-orange-500/30 via-red-500/20 to-transparent rounded-full blur-3xl animate-pulse" 
             style={{ animationDuration: '2s' }} />
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-gradient-to-br from-yellow-500/30 via-orange-500/20 to-transparent rounded-full blur-3xl animate-pulse" 
             style={{ animationDuration: '3s', animationDelay: '0.5s' }} />
      </div>

      <div className="relative p-6 h-full flex flex-col">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className={`text-sm font-semibold mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              XP Converter
            </h3>
            <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Pay {PAYMENT_AMOUNT_USD} USD • Min: {MINIMUM_XP} XP • Rate: 1000 XP = 100 points
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
          {isCheckingPending ? (
            <div className="space-y-3 flex-1 flex flex-col justify-between">
              <div className={`h-3 rounded animate-pulse w-full ${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'}`}></div>
              <div className={`h-10 rounded-lg animate-pulse w-full ${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'}`}></div>
            </div>
          ) : (
            <>
              {/* Resume Conversion UI */}
              {showResumeConversion && pendingConversion && (
                <div className={`rounded-xl p-4 border ${
                  isDarkMode 
                    ? 'bg-yellow-900/20 border-yellow-500/30' 
                    : 'bg-yellow-50 border-yellow-200'
                }`}>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      <AlertTriangle className={`w-5 h-5 ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'}`} />
                    </div>
                    <div className="flex-1">
                      <h4 className={`text-sm font-semibold mb-1 ${
                        isDarkMode ? 'text-yellow-400' : 'text-yellow-800'
                      }`}>
                        Incomplete Conversion Detected
                      </h4>
                      <p className={`text-xs mb-3 ${
                        isDarkMode ? 'text-yellow-300' : 'text-yellow-700'
                      }`}>
                        You paid for a conversion but it wasn't completed. 
                        Click below to resume without paying again.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => resumeConversion(pendingConversion)}
                          disabled={isConverting}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            isDarkMode
                              ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                              : 'bg-yellow-600 hover:bg-yellow-700 text-white'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {isConverting ? 'Resuming...' : 'Resume Conversion'}
                        </button>
                        <button
                          onClick={dismissPendingConversion}
                          disabled={isConverting}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            isDarkMode
                              ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                              : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Balance Info */}
              <div className="space-y-2 flex-1">
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Available: {currentXP.toLocaleString()} XP
                  </span>
                  <div className={`flex items-center space-x-1 text-xs ${
                    currentXP >= MINIMUM_XP
                      ? 'text-green-600'
                      : currentXP > 0
                      ? 'text-yellow-600'
                      : isDarkMode ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                    <div className={`w-1.5 h-1.5 rounded-full mr-2 ${
                      currentXP >= MINIMUM_XP 
                        ? 'bg-green-500 animate-pulse' 
                        : currentXP > 0
                        ? 'bg-yellow-500'
                        : 'bg-gray-400'
                      }`} />
                    {currentXP >= MINIMUM_XP 
                      ? 'Ready to convert' 
                      : currentXP > 0 
                      ? `Need ${MINIMUM_XP - currentXP} more XP`
                      : 'No XP available'}
                  </div>
                </div>
                
                {/* Minimum XP requirement message */}
                {currentXP > 0 && currentXP < MINIMUM_XP && (
                  <div className={`text-xs p-2 rounded-lg ${
                    isDarkMode 
                      ? 'bg-yellow-900/20 text-yellow-400 border border-yellow-500/30' 
                      : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                  }`}>
                    <div className="flex items-start gap-2">
                      <span>
                        Minimum {MINIMUM_XP} XP required. You need {MINIMUM_XP - currentXP} more XP to convert.
                      </span>
                    </div>
                  </div>
                )}
                
                {loadingPrice ? (
                  <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Loading price...
                  </div>
                ) : (
                  <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Payment: {PAYMENT_AMOUNT_USD} USD (~{ethAmount.toFixed(6)} ETH)
                  </div>
                )}
              </div>

              {/* Convert Button */}
              <button
                onClick={handleConvert}
                disabled={isConvertDisabled()}
                className={`w-full px-4 py-3 rounded-lg font-medium transition-all duration-200 transform ${
                  isConvertDisabled()
                    ? 'bg-gray-400 cursor-not-allowed opacity-50'
                    : isDarkMode
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700'
                    : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600'
                } text-white shadow-lg hover:scale-105`}
              >
                {isPaymentPending ? (
                  <span>Processing Payment...</span>
                ) : isConverting ? (
                  <span>Converting...</span>
                ) : loadingPrice ? (
                  <span>Loading...</span>
                ) : currentXP < MINIMUM_XP ? (
                  <span>Minimum {MINIMUM_XP} XP Required</span>
                ) : (
                  <span>Convert All XP ({calculatedPoints.toFixed(1)} points)</span>
                )}
              </button>
            </>
          )}
        </div>

        {/* Error Message */}
        {conversionError && (
          <div className="mt-3">
            <ErrorDisplay
              message={conversionError}
              severity="error"
              onRetry={canRetryConversion ? handleConvert : undefined}
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
    </div>
  );
}
