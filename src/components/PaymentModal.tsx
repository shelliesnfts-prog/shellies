'use client';

import { useState, useEffect } from 'react';
import { useAccount, useSwitchChain } from 'wagmi';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, CheckCircle, AlertCircle, Wallet, ArrowRight, ExternalLink } from 'lucide-react';
import { formatEther } from 'viem';
import { useTheme } from '@/contexts/ThemeContext';
import { inkChain } from '@/lib/wagmi';
import { GamePaymentService } from '@/lib/contracts';
import ErrorDisplay from '@/components/ErrorDisplay';

/**
 * Payment status states for the modal with detailed steps
 */
type PaymentStatus = 
  | 'idle' 
  | 'signing'           // Waiting for wallet signature
  | 'confirming'        // Transaction confirming on blockchain
  | 'creating_session'  // Creating game session on server
  | 'loading_game'      // Loading game console
  | 'success'           // Complete
  | 'error';            // Error occurred

/**
 * Props for PaymentModal component
 */
interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess: () => void;
  requiredAmount: bigint; // in wei
  usdAmount: number; // 0.04
  onInitiatePayment: () => Promise<boolean>;
  paymentLoading: boolean;
  paymentError: string | null;
  canRetryPayment?: boolean;
  onRetryPayment?: () => Promise<boolean>;
  transactionHash?: string | null;
  sessionCreating?: boolean;  // New prop for session creation state
  sessionCreated?: boolean;   // New prop for session created state
}

/**
 * PaymentModal Component
 * 
 * Displays payment interface for game entry with the following features:
 * - Shows USD amount (0.04) and calculated ETH amount
 * - Handles payment status states (idle, pending, confirming, success, error)
 * - Triggers wagmi writeContract for payment
 * - Displays transaction hash with Ink explorer link
 * - Styled with purple/pink gradient theme and framer-motion animations
 * - Handles wallet connection and insufficient balance errors
 * - Checks and switches to Ink network if needed
 */
export default function PaymentModal({
  isOpen,
  onClose,
  onPaymentSuccess,
  requiredAmount,
  usdAmount,
  onInitiatePayment,
  paymentLoading,
  paymentError,
  canRetryPayment = true,
  onRetryPayment,
  transactionHash,
  sessionCreating = false,
  sessionCreated = false,
}: PaymentModalProps) {
  const { address, isConnected, chain } = useAccount();
  const { switchChain } = useSwitchChain();
  const { isDarkMode } = useTheme();
  
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('idle');
  const [localError, setLocalError] = useState<string | null>(null);
  const [isWrongNetwork, setIsWrongNetwork] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  // Check if user is on the correct network
  useEffect(() => {
    if (isConnected && chain) {
      setIsWrongNetwork(chain.id !== inkChain.id);
    } else {
      setIsWrongNetwork(false);
    }
  }, [isConnected, chain]);

  // Update payment status based on loading state with detailed steps
  useEffect(() => {
    if (paymentError) {
      setPaymentStatus('error');
      setLocalError(paymentError);
      setCurrentStep(0);
    } else if (sessionCreated) {
      // Step 4: Game loading
      setPaymentStatus('loading_game');
      setCurrentStep(3);
      // Auto-close modal and show game
      setTimeout(() => {
        setPaymentStatus('success');
        setCurrentStep(4);
        onPaymentSuccess();
        onClose();
      }, 800);
    } else if (sessionCreating) {
      // Step 3: Creating session
      setPaymentStatus('creating_session');
      setCurrentStep(2);
    } else if (transactionHash && !paymentLoading) {
      // Step 2: Transaction confirmed, waiting for session creation
      setPaymentStatus('confirming');
      setCurrentStep(2);
    } else if (transactionHash && paymentLoading) {
      // Step 2: Transaction confirming
      setPaymentStatus('confirming');
      setCurrentStep(1);
    } else if (paymentLoading) {
      // Step 1: Waiting for signature
      setPaymentStatus('signing');
      setCurrentStep(0);
    } else {
      setPaymentStatus('idle');
      setCurrentStep(0);
    }
  }, [paymentLoading, paymentError, transactionHash, sessionCreating, sessionCreated, onPaymentSuccess, onClose]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setPaymentStatus('idle');
      setLocalError(null);
    }
  }, [isOpen]);

  /**
   * Handle backdrop click to close modal
   */
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !paymentLoading) {
      onClose();
    }
  };

  /**
   * Handle network switch to Ink
   */
  const handleSwitchNetwork = async () => {
    try {
      await switchChain({ chainId: inkChain.id });
      setLocalError(null);
    } catch (error) {
      console.error('Error switching network:', error);
      setLocalError('Failed to switch network. Please switch manually in your wallet.');
    }
  };

  /**
   * Handle payment initiation with comprehensive validation
   */
  const handlePayment = async () => {
    if (!isConnected) {
      setLocalError('Please connect your wallet first');
      return;
    }

    if (isWrongNetwork) {
      setLocalError('Please switch to Ink network');
      return;
    }

    setLocalError(null);
    await onInitiatePayment();
    // Success will be handled by the useEffect that watches for transaction confirmation
  };

  /**
   * Handle retry payment
   */
  const handleRetry = async () => {
    setLocalError(null);
    if (onRetryPayment) {
      await onRetryPayment();
    } else {
      await handlePayment();
    }
  };

  /**
   * Format ETH amount for display
   */
  const formattedEth = requiredAmount > BigInt(0) 
    ? parseFloat(formatEther(requiredAmount)).toFixed(6)
    : '0.000000';

  /**
   * Get status icon based on payment status
   */
  const getStatusIcon = () => {
    switch (paymentStatus) {
      case 'signing':
      case 'confirming':
      case 'creating_session':
      case 'loading_game':
        return <Loader2 className="w-12 h-12 text-purple-600 animate-spin" />;
      case 'success':
        return <CheckCircle className="w-12 h-12 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-12 h-12 text-red-500" />;
      default:
        return <Wallet className="w-12 h-12 text-purple-600" />;
    }
  };

  /**
   * Get status message based on payment status with detailed steps
   */
  const getStatusMessage = () => {
    switch (paymentStatus) {
      case 'signing':
        return 'Please sign the transaction in your wallet...';
      case 'confirming':
        return 'Confirming transaction on Ink network...';
      case 'creating_session':
        return 'Creating your game session...';
      case 'loading_game':
        return 'Loading game console...';
      case 'success':
        return 'All set! Enjoy the game!';
      case 'error':
        return localError || paymentError || 'Payment failed';
      default:
        return 'Pay to play the game';
    }
  };

  /**
   * Get progress steps for visual feedback
   */
  const getProgressSteps = () => {
    return [
      { label: 'Sign Transaction', completed: currentStep > 0, active: currentStep === 0 },
      { label: 'Confirm on Chain', completed: currentStep > 1, active: currentStep === 1 },
      { label: 'Create Session', completed: currentStep > 2, active: currentStep === 2 },
      { label: 'Load Game', completed: currentStep > 3, active: currentStep === 3 },
    ];
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={handleBackdropClick}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          className={`max-w-md w-full rounded-2xl shadow-2xl overflow-hidden transition-colors duration-300 ${
            isDarkMode ? 'bg-gray-800' : 'bg-white'
          }`}
        >
          {/* Header with gradient */}
          <div className="relative bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white mb-1">
                  Pay to Play
                </h2>
                <p className="text-purple-100 text-sm">
                  One-time payment to start your game session
                </p>
              </div>
              {!paymentLoading && (
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-white/10 text-white transition-colors duration-200"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Status Icon */}
            <motion.div
              key={paymentStatus}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="flex justify-center"
            >
              {getStatusIcon()}
            </motion.div>

            {/* Status Message */}
            <motion.div
              key={`${paymentStatus}-message`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="text-center"
            >
              <p className={`text-sm font-medium ${
                paymentStatus === 'error' ? 'text-red-600' :
                paymentStatus === 'success' ? 'text-green-600' :
                isDarkMode ? 'text-gray-300' : 'text-gray-600'
              }`}>
                {getStatusMessage()}
              </p>
            </motion.div>

            {/* Progress Steps - Show during payment process */}
            {(paymentStatus === 'signing' || paymentStatus === 'confirming' || 
              paymentStatus === 'creating_session' || paymentStatus === 'loading_game') && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.2 }}
                className={`rounded-xl p-4 ${
                  isDarkMode ? 'bg-gray-900/50' : 'bg-gray-50'
                }`}
              >
                <div className="space-y-3">
                  {getProgressSteps().map((step, index) => (
                    <div key={index} className="flex items-center gap-3">
                      {/* Step indicator */}
                      <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 ${
                        step.completed 
                          ? 'bg-green-500' 
                          : step.active 
                            ? 'bg-purple-600 animate-pulse' 
                            : isDarkMode ? 'bg-gray-700' : 'bg-gray-300'
                      }`}>
                        {step.completed ? (
                          <CheckCircle className="w-4 h-4 text-white" />
                        ) : step.active ? (
                          <Loader2 className="w-4 h-4 text-white animate-spin" />
                        ) : (
                          <span className={`text-xs font-bold ${
                            isDarkMode ? 'text-gray-500' : 'text-gray-500'
                          }`}>{index + 1}</span>
                        )}
                      </div>
                      
                      {/* Step label */}
                      <span className={`text-sm font-medium transition-colors duration-300 ${
                        step.completed 
                          ? 'text-green-600' 
                          : step.active 
                            ? isDarkMode ? 'text-white' : 'text-gray-900'
                            : isDarkMode ? 'text-gray-500' : 'text-gray-400'
                      }`}>
                        {step.label}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Payment Amount Display */}
            {paymentStatus === 'idle' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.2 }}
                className={`rounded-xl p-6 border transition-colors duration-300 ${
                  isDarkMode 
                    ? 'bg-gradient-to-br from-purple-900/40 to-pink-900/40 border-purple-700/50' 
                    : 'bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200'
                }`}
              >
                <div className="space-y-4">
                  {/* USD Amount */}
                  <div className="text-center">
                    <p className={`text-sm mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Amount</p>
                    <p className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                      ${usdAmount.toFixed(2)}
                    </p>
                  </div>

                  {/* Divider */}
                  <div className="flex items-center gap-3">
                    <div className={`flex-1 h-px ${
                      isDarkMode 
                        ? 'bg-gradient-to-r from-transparent via-purple-500/50 to-transparent' 
                        : 'bg-gradient-to-r from-transparent via-purple-300 to-transparent'
                    }`}></div>
                    <ArrowRight className={`w-4 h-4 ${isDarkMode ? 'text-purple-500' : 'text-purple-400'}`} />
                    <div className={`flex-1 h-px ${
                      isDarkMode 
                        ? 'bg-gradient-to-r from-transparent via-purple-500/50 to-transparent' 
                        : 'bg-gradient-to-r from-transparent via-purple-300 to-transparent'
                    }`}></div>
                  </div>

                  {/* ETH Amount */}
                  <div className="text-center">
                    <p className={`text-sm mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Equivalent in ETH</p>
                    <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {formattedEth} ETH
                    </p>
                    <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>on Ink Network</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Transaction Hash Display */}
            {transactionHash && (paymentStatus === 'confirming' || paymentStatus === 'success') && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`rounded-xl p-4 border transition-colors duration-300 ${
                  isDarkMode ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-200'
                }`}
              >
                <p className={`text-xs mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Transaction Hash</p>
                <div className="flex items-center gap-2">
                  <p className={`text-xs font-mono truncate flex-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
                    {transactionHash}
                  </p>
                  <a
                    href={GamePaymentService.getExplorerTxUrl(transactionHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex-shrink-0 p-2 rounded-lg text-purple-600 transition-colors duration-200 ${
                      isDarkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-200'
                    }`}
                    title="View on Ink Explorer"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </motion.div>
            )}

            {/* Wrong Network Warning */}
            {isWrongNetwork && paymentStatus === 'idle' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-yellow-50 border border-yellow-200 rounded-xl p-4"
              >
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-yellow-900 mb-1">
                      Wrong Network
                    </p>
                    <p className="text-xs text-yellow-700 mb-3">
                      Please switch to Ink network to continue
                    </p>
                    <button
                      onClick={handleSwitchNetwork}
                      className="text-xs font-medium text-yellow-900 bg-yellow-200 hover:bg-yellow-300 px-3 py-1.5 rounded-lg transition-colors duration-200"
                    >
                      Switch to Ink Network
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Error Display */}
            {paymentStatus === 'error' && (localError || paymentError) && (
              <ErrorDisplay
                message={localError || paymentError || 'Payment failed'}
                severity="error"
                onRetry={canRetryPayment ? handleRetry : undefined}
                canRetry={canRetryPayment}
                className="mb-4"
              />
            )}

            {/* Action Buttons */}
            <div className="space-y-3">
              {paymentStatus === 'idle' && (
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.3 }}
                  onClick={handlePayment}
                  disabled={!isConnected || isWrongNetwork || requiredAmount === BigInt(0)}
                  className={`w-full py-4 rounded-xl font-semibold text-white transition-all duration-200 ${
                    !isConnected || isWrongNetwork || requiredAmount === BigInt(0)
                      ? 'bg-gray-300 cursor-not-allowed'
                      : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg hover:shadow-xl transform hover:scale-[1.02]'
                  }`}
                >
                  {!isConnected ? 'Connect Wallet First' :
                   isWrongNetwork ? 'Switch Network First' :
                   requiredAmount === BigInt(0) ? 'Loading Price...' :
                   'Pay to Play'}
                </motion.button>
              )}

              {!paymentLoading && paymentStatus !== 'success' && (
                <button
                  onClick={onClose}
                  className={`w-full py-3 rounded-xl font-medium transition-colors duration-200 ${
                    isDarkMode 
                      ? 'text-gray-300 bg-gray-700 hover:bg-gray-600' 
                      : 'text-gray-700 bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  Cancel
                </button>
              )}
            </div>

            {/* Wallet Connection Info */}
            {isConnected && address && paymentStatus === 'idle' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.4 }}
                className="text-center"
              >
                <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                  Connected: {address.slice(0, 6)}...{address.slice(-4)}
                </p>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
