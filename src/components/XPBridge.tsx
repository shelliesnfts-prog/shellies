'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '@/contexts/ThemeContext';
import { parseConversionError } from '@/lib/errors';
import ErrorDisplay from '@/components/ErrorDisplay';
import { logger, logConversionError } from '@/lib/logger';
import { AlertTriangle } from 'lucide-react';
import { PriceOracle } from '@/lib/price-oracle';
import { payForXPConversion, getTransactionTimestamp } from '@/lib/game-payment-service';
import { SHELLIES_POINTS_CONTRACT, SHELLIES_POINTS_ADDRESS } from '@/lib/shellies-points-contract';

/**
 * Default values (used while loading from API)
 */
const DEFAULT_CONVERSION_RATE = 10;
const DEFAULT_PAYMENT_AMOUNT_USD = 0.1;
const DEFAULT_MINIMUM_XP = 100;

/**
 * localStorage key for pending conversion (old payment-tx recovery)
 */
const PENDING_CONVERSION_KEY = 'pendingConversionTx';

/**
 * localStorage key for pending on-chain voucher (step 2)
 */
const PENDING_VOUCHER_KEY = 'shellies_pending_conversion';

/**
 * Max age for pending conversion (24 hours)
 */
const MAX_PENDING_AGE = 24 * 60 * 60 * 1000;

/**
 * Pending conversion interface (payment-tx recovery)
 */
interface PendingConversion {
  txHash: string;
  timestamp: number;
  xpAmount: number;
  paymentAmount: number;
  createdAt: number;
}

/**
 * Pending on-chain voucher (step 2 recovery)
 */
interface PendingVoucher {
  xpAmount: number;
  nonce: number;
  expiry: number;
  signature: string;
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

  // XP input state
  const [xpInput, setXpInput] = useState<string>('');

  // Dynamic settings from API
  const [conversionRate, setConversionRate] = useState<number>(DEFAULT_CONVERSION_RATE);
  const [paymentAmountUsd, setPaymentAmountUsd] = useState<number>(DEFAULT_PAYMENT_AMOUNT_USD);
  const [minimumXp, setMinimumXp] = useState<number>(DEFAULT_MINIMUM_XP);
  const [loadingSettings, setLoadingSettings] = useState<boolean>(true);

  // Recovery mechanism state (old payment-tx recovery)
  const [pendingConversion, setPendingConversion] = useState<PendingConversion | null>(null);
  const [showResumeConversion, setShowResumeConversion] = useState<boolean>(false);
  const [isCheckingPending, setIsCheckingPending] = useState<boolean>(true);

  // Step 2: pending on-chain voucher
  const [pendingVoucher, setPendingVoucher] = useState<PendingVoucher | null>(null);

  // On-chain convertXp write
  const {
    writeContract: writeConvertXp,
    data: convertXpTxHash,
    isPending: isConvertXpPending,
    error: convertXpWriteError,
  } = useWriteContract();

  const { isLoading: isConvertXpConfirming, isSuccess: isConvertXpSuccess } =
    useWaitForTransactionReceipt({ hash: convertXpTxHash });

  // Calculate points that will be received based on input
  const xpToConvert = xpInput ? parseInt(xpInput) || 0 : 0;
  const calculatedPoints = xpToConvert / conversionRate;
  const ethAmount = ethPrice > 0 ? paymentAmountUsd / ethPrice : 0;

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

  // Fetch XP conversion settings from API
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoadingSettings(true);
        const response = await fetch('/api/xp-settings');
        if (response.ok) {
          const data = await response.json();
          setConversionRate(data.conversionRate || DEFAULT_CONVERSION_RATE);
          setPaymentAmountUsd(data.feeUsd || DEFAULT_PAYMENT_AMOUNT_USD);
          setMinimumXp(data.minXp || DEFAULT_MINIMUM_XP);
        }
      } catch (error) {
        console.error('Failed to fetch XP settings:', error);
        // Keep defaults on error
      } finally {
        setLoadingSettings(false);
      }
    };

    fetchSettings();
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

  // Clear pending voucher from localStorage on success
  useEffect(() => {
    if (isConvertXpSuccess) {
      localStorage.removeItem(PENDING_VOUCHER_KEY);
      setPendingVoucher(null);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      // Refresh caller's balance
      onConversionComplete(currentXP, currentPoints);
    }
  }, [isConvertXpSuccess]);

  // Load pending voucher from localStorage on mount
  useEffect(() => {
    if (!address || !isConnected) return;
    try {
      const raw = localStorage.getItem(PENDING_VOUCHER_KEY);
      if (!raw) return;
      const voucher: PendingVoucher = JSON.parse(raw);
      const nowSec = Math.floor(Date.now() / 1000);
      if (voucher.expiry > nowSec) {
        setPendingVoucher(voucher);
      } else {
        localStorage.removeItem(PENDING_VOUCHER_KEY);
      }
    } catch {
      localStorage.removeItem(PENDING_VOUCHER_KEY);
    }
  }, [address, isConnected]);

  /**
   * Step 2: Submit on-chain convertXp transaction
   */
  const submitOnChainConversion = (voucher: PendingVoucher) => {
    setConversionError(null);
    writeConvertXp({
      address: SHELLIES_POINTS_ADDRESS,
      abi: SHELLIES_POINTS_CONTRACT.abi,
      functionName: 'convertXp',
      args: [
        BigInt(voucher.xpAmount),
        BigInt(voucher.nonce),
        BigInt(voucher.expiry),
        voucher.signature as `0x${string}`,
      ],
    });
  };

  /**
   * Handle conversion: pay → get voucher from API → show Step 2
   */
  const handleConvert = async () => {
    if (!address || !isConnected) {
      setConversionError('Please connect your wallet first');
      setCanRetryConversion(false);
      return;
    }

    if (currentXP <= 0) {
      setConversionError('You have no XP to convert');
      setCanRetryConversion(false);
      return;
    }

    const xpAmount = parseInt(xpInput) || 0;

    if (xpAmount < minimumXp) {
      setConversionError(`Minimum ${minimumXp} XP required to convert.`);
      setCanRetryConversion(false);
      return;
    }

    if (xpAmount > currentXP) {
      setConversionError(`You only have ${currentXP} XP available.`);
      setCanRetryConversion(false);
      return;
    }

    if (ethPrice <= 0) {
      setConversionError('Loading ETH price... Please try again');
      setCanRetryConversion(true);
      return;
    }

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
        paymentAmount: paymentAmountUsd,
        ethAmount,
        ethPrice,
      });

      const txHash = await payForXPConversion(paymentAmountUsd, ethPrice);

      logger.conversion('Payment transaction confirmed', { walletAddress: address, txHash });

      const txTimestamp = await getTransactionTimestamp(txHash);
      savePendingConversion(txHash, txTimestamp, xpAmount, paymentAmountUsd);

      setIsPaymentPending(false);

      // Step 2: Get signed voucher from API
      const response = await fetch('/api/bridge/convert-xp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ xpAmount, txHash }),
      });

      const data = await response.json();

      if (!response.ok) {
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
          txHash,
        });
        return;
      }

      // Clear old payment-tx recovery record
      localStorage.removeItem(PENDING_CONVERSION_KEY);

      // Store voucher for step 2 recovery
      const voucher: PendingVoucher = {
        xpAmount: data.xpAmount,
        nonce: data.nonce,
        expiry: data.expiry,
        signature: data.signature,
      };
      localStorage.setItem(PENDING_VOUCHER_KEY, JSON.stringify(voucher));
      setPendingVoucher(voucher);

    } catch (err: unknown) {
      const error = err as Error;
      console.error('Conversion error:', error);

      if (isPaymentPending) {
        setConversionError(error.message || 'Payment transaction failed. Please try again.');
        setCanRetryConversion(true);
      } else {
        setConversionError(
          'Payment successful but voucher request failed. Your payment is saved — refresh the page to resume.'
        );
        setCanRetryConversion(false);
      }

      logConversionError(error, {
        action: 'convertXP',
        walletAddress: address,
        xpAmount: parseInt(xpInput) || 0,
        isPaymentPending,
      });
    } finally {
      setIsConverting(false);
      setIsPaymentPending(false);
    }
  };

  /**
   * Resume conversion with existing payment (old payment-tx recovery)
   */
  const resumeConversion = async (pending: PendingConversion) => {
    setIsConverting(true);
    setConversionError(null);

    try {
      const response = await fetch('/api/bridge/convert-xp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ xpAmount: pending.xpAmount, txHash: pending.txHash }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Conversion failed');
      }

      localStorage.removeItem(PENDING_CONVERSION_KEY);

      const voucher: PendingVoucher = {
        xpAmount: data.xpAmount,
        nonce: data.nonce,
        expiry: data.expiry,
        signature: data.signature,
      };
      localStorage.setItem(PENDING_VOUCHER_KEY, JSON.stringify(voucher));
      setPendingVoucher(voucher);
      setShowResumeConversion(false);
      setPendingConversion(null);

    } catch (err: unknown) {
      const error = err as Error;
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
    if (isConverting || isPaymentPending || loadingPrice || loadingSettings) return true;
    if (currentXP < minimumXp) return true;
    if (ethPrice <= 0) return true;
    // Validate input
    const inputAmount = parseInt(xpInput) || 0;
    if (inputAmount < minimumXp || inputAmount > currentXP) return true;
    return false;
  };

  /**
   * Handle XP input change with validation
   */
  const handleXpInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow empty or numeric values only
    if (value === '' || /^\d+$/.test(value)) {
      setXpInput(value);
      setConversionError(null);
    }
  };

  /**
   * Set max XP amount
   */
  const handleSetMax = () => {
    setXpInput(currentXP.toString());
    setConversionError(null);
  };

  /**
   * Get input validation state
   */
  const getInputValidation = (): { isValid: boolean; message: string } => {
    if (!xpInput) return { isValid: true, message: '' };
    const amount = parseInt(xpInput) || 0;
    if (amount < minimumXp) {
      return { isValid: false, message: `Minimum ${minimumXp} XP` };
    }
    if (amount > currentXP) {
      return { isValid: false, message: `Max ${currentXP} XP` };
    }
    return { isValid: true, message: '' };
  };

  const inputValidation = getInputValidation();

  return (
    <div className={`h-full rounded-2xl border ${isDarkMode
      ? 'bg-gray-800/80 border-gray-700'
      : 'bg-white border-gray-200'
      }`}>
      <div className="p-5 h-full flex flex-col justify-center">
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-2">
          <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-purple-500/15' : 'bg-purple-50'}`}>
            <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </div>
          <div>
            <h3 className={`text-sm font-semibold leading-none ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              XP Converter
            </h3>
            {loadingSettings ? (
              <div className={`h-2.5 w-40 rounded mt-1 animate-pulse ${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'}`} />
            ) : (
              <p className={`text-[11px] mt-0.5 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                {conversionRate * 100} XP = 100 pts · fee ${paymentAmountUsd} USD
              </p>
            )}
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
                <div className={`rounded-xl p-4 border ${isDarkMode
                    ? 'bg-yellow-900/20 border-yellow-500/30'
                    : 'bg-yellow-50 border-yellow-200'
                  }`}>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      <AlertTriangle className={`w-5 h-5 ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'}`} />
                    </div>
                    <div className="flex-1">
                      <h4 className={`text-sm font-semibold mb-1 ${isDarkMode ? 'text-yellow-400' : 'text-yellow-800'
                        }`}>
                        Incomplete Conversion Detected
                      </h4>
                      <p className={`text-xs mb-3 ${isDarkMode ? 'text-yellow-300' : 'text-yellow-700'
                        }`}>
                        You paid for a conversion but it wasn't completed.
                        Click below to resume without paying again.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => resumeConversion(pendingConversion)}
                          disabled={isConverting}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${isDarkMode
                              ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                              : 'bg-yellow-600 hover:bg-yellow-700 text-white'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {isConverting ? 'Resuming...' : 'Resume Conversion'}
                        </button>
                        <button
                          onClick={dismissPendingConversion}
                          disabled={isConverting}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${isDarkMode
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
              <div className="space-y-2">
                {/* XP balance row */}
                <div className={`flex items-center justify-between px-3 py-2 rounded-xl ${isDarkMode ? 'bg-gray-700/40' : 'bg-gray-50'}`}>
                  <div>
                    <span className={`text-[11px] ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      Available XP   <span className={`text-sm font-semibold tabular-nums leading-none ml-0.5 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        {currentXP.toLocaleString()}
                      </span>
                    </span>
                  </div>
                  <div className={`px-2 py-1 rounded-lg text-[11px] font-medium ${currentXP >= minimumXp
                      ? isDarkMode ? 'bg-green-500/15 text-green-400' : 'bg-green-50 text-green-700'
                      : currentXP > 0
                        ? isDarkMode ? 'bg-yellow-500/15 text-yellow-400' : 'bg-yellow-50 text-yellow-700'
                        : isDarkMode ? 'bg-gray-600/50 text-gray-500' : 'bg-gray-100 text-gray-500'
                    }`}>
                    {currentXP >= minimumXp
                      ? 'Ready'
                      : currentXP > 0
                        ? `Need ${minimumXp - currentXP} more`
                        : 'No XP'}
                  </div>
                </div>

                {/* Input skeleton while loading settings */}
                {loadingSettings && currentXP > 0 && (
                  <div className={`h-10 w-full rounded-xl animate-pulse ${isDarkMode ? 'bg-gray-700/60' : 'bg-gray-100'}`} />
                )}

                {/* XP Input Field */}
                {currentXP >= minimumXp && !loadingSettings && (
                  <div className="space-y-2">
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={xpInput}
                        onChange={handleXpInputChange}
                        placeholder={`${minimumXp}–${currentXP} XP`}
                        disabled={isConverting || isPaymentPending}
                        className={`w-full px-3 py-2.5 pr-14 rounded-xl text-sm transition-colors ${isDarkMode
                            ? 'bg-gray-700/60 border-gray-600 text-white placeholder-gray-500'
                            : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'
                          } border ${!inputValidation.isValid
                            ? 'border-red-400 focus:border-red-400 focus:ring-red-400'
                            : 'focus:border-purple-500 focus:ring-purple-500'
                          } focus:outline-none focus:ring-1 disabled:opacity-50 disabled:cursor-not-allowed`}
                      />
                      <button
                        type="button"
                        onClick={handleSetMax}
                        disabled={isConverting || isPaymentPending}
                        className={`absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-[11px] font-semibold rounded-lg transition-colors ${isDarkMode
                            ? 'bg-purple-600/80 hover:bg-purple-600 text-white'
                            : 'bg-purple-100 hover:bg-purple-200 text-purple-700'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        MAX
                      </button>
                    </div>
                    {!inputValidation.isValid && (
                      <p className="text-[11px] text-red-500">{inputValidation.message}</p>
                    )}
                    {xpInput && inputValidation.isValid && (
                      <div className={`flex items-center justify-between text-[11px] ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                        <span>You receive</span>
                        <span className={`font-semibold tabular-nums ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}>
                          {calculatedPoints.toFixed(1)} points
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Minimum XP requirement message */}
                {!loadingSettings && currentXP > 0 && currentXP < minimumXp && (
                  <div className={`text-[11px] px-3 py-2 rounded-xl ${isDarkMode
                      ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                      : 'bg-yellow-50 text-yellow-700 border border-yellow-100'
                    }`}>
                    Minimum {minimumXp} XP required — need {minimumXp - currentXP} more.
                  </div>
                )}

                {/* Fee info */}
                {loadingPrice || loadingSettings ? (
                  <div className={`h-2.5 w-32 rounded animate-pulse ${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'}`} />
                ) : (
                  <p className={`text-[11px] ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`}>
                    Fee: {paymentAmountUsd} USD · ~{ethAmount.toFixed(6)} ETH
                  </p>
                )}
              </div>

              {/* Step 2: On-chain confirmation panel */}
              {pendingVoucher && (
                <div className={`rounded-xl p-4 border ${isDarkMode
                    ? 'bg-blue-900/20 border-blue-500/30'
                    : 'bg-blue-50 border-blue-200'
                  }`}>
                  <p className={`text-xs font-semibold mb-1 ${isDarkMode ? 'text-blue-300' : 'text-blue-800'}`}>
                    XP Reserved — Confirm On-Chain
                  </p>
                  <p className={`text-xs mb-3 ${isDarkMode ? 'text-blue-200' : 'text-blue-700'}`}>
                    Your XP has been reserved. Submit the transaction below to receive your ShelliesPoints.
                  </p>
                  {convertXpWriteError && (
                    <p className="text-xs text-red-500 mb-2">{convertXpWriteError.message}</p>
                  )}
                  <button
                    onClick={() => submitOnChainConversion(pendingVoucher)}
                    disabled={isConvertXpPending || isConvertXpConfirming}
                    className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isConvertXpPending
                      ? 'Waiting for wallet...'
                      : isConvertXpConfirming
                        ? 'Confirming...'
                        : `Confirm: ${pendingVoucher.xpAmount} XP → ShelliesPoints`}
                  </button>
                </div>
              )}

              {/* Convert Button (Step 1) */}
              {!pendingVoucher && (
                <button
                  onClick={handleConvert}
                  disabled={isConvertDisabled()}
                  className={`w-full px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${isConvertDisabled()
                      ? `cursor-not-allowed ${isDarkMode ? 'bg-gray-700/60 text-gray-500' : 'bg-gray-100 text-gray-400'}`
                      : `text-white shadow-sm hover:shadow-md hover:shadow-purple-500/20 ${isDarkMode
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700'
                        : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600'
                      }`
                    }`}
                >
                  {isPaymentPending ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
                      Processing payment…
                    </span>
                  ) : isConverting ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
                      Getting voucher…
                    </span>
                  ) : loadingPrice ? (
                    <span>Loading…</span>
                  ) : currentXP < minimumXp ? (
                    <span>Minimum {minimumXp} XP required</span>
                  ) : !xpInput || !inputValidation.isValid ? (
                    <span>Enter XP amount</span>
                  ) : (
                    <span>Convert {xpToConvert.toLocaleString()} XP → {calculatedPoints.toFixed(1)} pts</span>
                  )}
                </button>
              )}
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
