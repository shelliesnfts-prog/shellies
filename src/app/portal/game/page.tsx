'use client';

import { useState, useEffect } from 'react';
import { PortalSidebar } from '@/components/portal/PortalSidebar';
import { useTheme } from '@/contexts/ThemeContext';
import { useGamePayment } from '@/hooks/useGamePayment';
import dynamic from 'next/dynamic';
import PaymentModal from '@/components/PaymentModal';
import { useWaitForTransactionReceipt, useWriteContract } from 'wagmi';

// Dynamically import the game component to ensure it only loads on client side
const MarioGameConsoleV2 = dynamic(() => import('@/components/MarioGameConsoleV2'), {
  ssr: false,
  loading: () => {
    const { isDarkMode } = useTheme();
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
});

export default function GamePage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(true);
  const { isDarkMode } = useTheme();

  // Use the payment hook with enhanced error handling
  const {
    hasActivePayment,
    paymentLoading,
    paymentError,
    canRetryPayment,
    ethPrice,
    requiredEth,
    initiatePayment,
    checkPaymentStatus,
    retryPayment,
    clearPaymentSession,
    sessionCreating,
    sessionCreated,
  } = useGamePayment();

  // Get transaction hash from wagmi
  const { data: hash } = useWriteContract();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Check payment status on mount
  useEffect(() => {
    if (isMounted) {
      setCheckingPayment(true);
      const hasPayment = checkPaymentStatus();
      
      // If no active payment, show payment modal
      if (!hasPayment) {
        setShowPaymentModal(true);
      }
      
      setCheckingPayment(false);
    }
  }, [isMounted, checkPaymentStatus]);

  // Listen for payment required events (from score submission failures)
  useEffect(() => {
    const handlePaymentRequired = (event: CustomEvent) => {
      console.log('Payment required event received:', event.detail);
      // Clear payment session and show modal
      clearPaymentSession();
      setShowPaymentModal(true);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('paymentRequired', handlePaymentRequired as EventListener);
      
      return () => {
        window.removeEventListener('paymentRequired', handlePaymentRequired as EventListener);
      };
    }
  }, [clearPaymentSession]);

  // Handle payment success
  const handlePaymentSuccess = () => {
    setShowPaymentModal(false);
  };

  // Handle modal close
  const handleModalClose = () => {
    // Only allow closing if payment is complete or user hasn't started payment
    if (!paymentLoading) {
      setShowPaymentModal(false);
    }
  };

  return (
    <div className={`min-h-screen flex transition-colors duration-300 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <PortalSidebar
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:ml-4 min-h-screen">
        <main className="flex-1 p-3 sm:p-4 lg:p-6 mt-16 lg:mt-0 mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-8">
          {/* Loading state while checking payment */}
          {checkingPayment && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <div className={`h-8 w-48 rounded animate-pulse mb-2 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`} />
                  <div className={`h-4 w-64 rounded animate-pulse ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`} />
                </div>
              </div>
              <div className={`rounded-2xl border overflow-hidden ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                <div className="relative w-full bg-black flex items-center justify-center overflow-hidden">
                  <div className={`animate-pulse ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`} style={{ width: '1282px', height: '532px', maxWidth: '100%' }} />
                </div>
              </div>
            </div>
          )}

          {/* Show game only if payment is active and not checking */}
          {!checkingPayment && hasActivePayment && isMounted && <MarioGameConsoleV2 />}

          {/* Show payment required message if no payment and modal is closed */}
          {!checkingPayment && !hasActivePayment && !showPaymentModal && (
            <div className={`rounded-2xl border p-8 text-center ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <h2 className={`text-2xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Payment Required
              </h2>
              <p className={`mb-6 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                You need to pay to play the game. Click the button below to proceed.
              </p>
              <button
                onClick={() => setShowPaymentModal(true)}
                className="px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]"
              >
                Pay to Play
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Payment Modal with enhanced error handling and progress tracking */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={handleModalClose}
        onPaymentSuccess={handlePaymentSuccess}
        requiredAmount={requiredEth}
        onInitiatePayment={initiatePayment}
        paymentLoading={paymentLoading}
        paymentError={paymentError}
        canRetryPayment={canRetryPayment}
        onRetryPayment={retryPayment}
        transactionHash={hash || null}
        sessionCreating={sessionCreating}
        sessionCreated={sessionCreated}
        ethPrice={ethPrice}
      />
    </div>
  );
}
