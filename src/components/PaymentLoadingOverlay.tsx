'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { GamePaymentService } from '@/lib/contracts';
import ErrorDisplay from '@/components/ErrorDisplay';

/**
 * Payment status states for the overlay with detailed steps
 */
type PaymentStatus = 
  | 'signing'           // Waiting for wallet signature
  | 'confirming'        // Transaction confirming on blockchain
  | 'creating_session'  // Creating game session on server
  | 'loading_game'      // Loading game console
  | 'success'           // Complete
  | 'error';            // Error occurred

/**
 * Props for PaymentLoadingOverlay component
 */
interface PaymentLoadingOverlayProps {
  isVisible: boolean;
  paymentStatus: PaymentStatus;
  currentStep: number;
  transactionHash?: string | null;
  errorMessage?: string | null;
  canRetry?: boolean;
  onRetry?: () => void;
}

/**
 * PaymentLoadingOverlay Component
 * 
 * Displays a loading overlay on top of the game console during payment processing
 * Shows multi-step progress with detailed status messages
 */
export default function PaymentLoadingOverlay({
  isVisible,
  paymentStatus,
  currentStep,
  transactionHash,
  errorMessage,
  canRetry = true,
  onRetry,
}: PaymentLoadingOverlayProps) {
  const { isDarkMode } = useTheme();

  /**
   * Get status icon based on payment status
   */
  const getStatusIcon = () => {
    switch (paymentStatus) {
      case 'signing':
      case 'confirming':
      case 'creating_session':
      case 'loading_game':
        return <Loader2 className="w-16 h-16 text-purple-600 animate-spin" />;
      case 'success':
        return <CheckCircle className="w-16 h-16 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-16 h-16 text-red-500" />;
      default:
        return null;
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
        return errorMessage || 'Payment failed';
      default:
        return '';
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

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 rounded-2xl"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          className={`max-w-md w-full mx-4 rounded-2xl shadow-2xl overflow-hidden transition-colors duration-300 ${
            isDarkMode ? 'bg-gray-800' : 'bg-white'
          }`}
        >
          {/* Header with gradient */}
          <div className="relative bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 p-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white mb-1">
                Processing Payment
              </h2>
              <p className="text-purple-100 text-sm">
                Please wait while we process your transaction
              </p>
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

            {/* Error Display */}
            {paymentStatus === 'error' && errorMessage && (
              <ErrorDisplay
                message={errorMessage}
                severity="error"
                onRetry={canRetry ? onRetry : undefined}
                canRetry={canRetry}
              />
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
