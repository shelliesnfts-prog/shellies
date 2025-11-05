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
  const [pendingGameAction, setPendingGameAction] = useState<'start' | 'restart' | null>(null);
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

  // Listen for payment required events (from score submission failures or play button clicks)
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

  // Listen for game start attempts to check payment
  useEffect(() => {
    const handleGameStartAttempt = (event: CustomEvent) => {
      // Check if this is a forced payment request (from restart)
      const forcePayment = event.detail?.forcePayment;
      const action = event.detail?.action || 'start';
      
      if (forcePayment) {
        // For restart attempts, ensure session is fully cleared first
        clearPaymentSession();
        // Wait a tick to ensure state updates, then show modal
        setTimeout(() => {
          setPendingGameAction(action);
          setShowPaymentModal(true);
        }, 50);
      } else {
        // Check if user has active payment for regular play attempts
        const hasPayment = checkPaymentStatus();
        if (!hasPayment) {
          // Show payment modal if no active payment
          setPendingGameAction(action);
          setShowPaymentModal(true);
        }
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('gameStartAttempt', handleGameStartAttempt as EventListener);
      
      return () => {
        window.removeEventListener('gameStartAttempt', handleGameStartAttempt as EventListener);
      };
    }
  }, [checkPaymentStatus, clearPaymentSession]);

  // Handle payment success
  const handlePaymentSuccess = () => {
    setShowPaymentModal(false);
    
    // Notify game to proceed with pending action
    if (pendingGameAction) {
      // Dispatch event to notify game console that payment is complete
      window.dispatchEvent(new CustomEvent('paymentComplete', {
        detail: { action: pendingGameAction }
      }));
      setPendingGameAction(null);
    }
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
          {/* Always show game console - payment check happens when user clicks play */}
          {isMounted && <MarioGameConsoleV2 hasActivePayment={hasActivePayment} />}
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
