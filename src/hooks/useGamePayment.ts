/**
 * @file useGamePayment.ts
 * @description Hook for managing game payment state and blockchain interactions
 * Handles payment session management, ETH price fetching, and payment flow with wagmi
 */

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, useBalance } from 'wagmi';
import { parseEther } from 'viem';
import { PriceOracle } from '@/lib/price-oracle';
import { GAME_PAYMENT_CONTRACT, GamePaymentService } from '@/lib/contracts';
import { parsePaymentError, ERROR_CODES } from '@/lib/errors';
import { logger, logPaymentError } from '@/lib/logger';

/**
 * Payment session data structure stored in sessionStorage
 */
export interface PaymentSession {
  timestamp: number;
  transactionHash: string;
  amount: string; // in ETH
  walletAddress: string;
}

/**
 * Session storage key for payment data
 */
const PAYMENT_SESSION_KEY = 'gamePaymentSession';

/**
 * Return type for useGamePayment hook
 */
export interface UseGamePaymentReturn {
  hasActivePayment: boolean;
  paymentLoading: boolean;
  paymentError: string | null;
  paymentErrorCode: string | null;
  canRetryPayment: boolean;
  ethPrice: number | null;
  requiredEth: bigint;
  initiatePayment: () => Promise<boolean>;
  clearPaymentSession: () => void;
  checkPaymentStatus: () => boolean;
  retryPayment: () => Promise<boolean>;
  sessionCreating: boolean;  // New: Track session creation
  sessionCreated: boolean;   // New: Track session created
  isStaker: boolean;         // Staker status
  isNFTHolder: boolean;      // NFT holder status
  nftCount: number;          // Number of NFTs owned
  paymentTier: string;       // Payment tier (regular, nft_holder, or staker)
}

/**
 * Session Storage Management Functions
 */

/**
 * Check if there's an active payment session in sessionStorage
 * @returns true if valid payment session exists
 */
export function checkPaymentStatus(): boolean {
  if (typeof window === 'undefined') return false;
  
  try {
    const sessionData = sessionStorage.getItem(PAYMENT_SESSION_KEY);
    if (!sessionData) return false;
    
    const session: PaymentSession = JSON.parse(sessionData);
    
    // Validate session has required fields
    if (!session.timestamp || !session.transactionHash || !session.walletAddress) {
      return false;
    }
    
    // Session is valid
    return true;
  } catch (error) {
    console.error('Error checking payment status:', error);
    return false;
  }
}

/**
 * Store payment confirmation in sessionStorage
 * @param transactionHash - The transaction hash from successful payment
 * @param amount - The amount paid in ETH
 * @param walletAddress - The wallet address that made the payment
 */
export function storePaymentSession(
  transactionHash: string,
  amount: string,
  walletAddress: string
): void {
  if (typeof window === 'undefined') return;
  
  try {
    const session: PaymentSession = {
      timestamp: Date.now(),
      transactionHash,
      amount,
      walletAddress,
    };
    
    sessionStorage.setItem(PAYMENT_SESSION_KEY, JSON.stringify(session));
  } catch (error) {
    console.error('Error storing payment session:', error);
  }
}

/**
 * Clear payment session from sessionStorage
 * Called when game over event occurs
 */
export function clearPaymentSession(): void {
  if (typeof window === 'undefined') return;
  
  try {
    sessionStorage.removeItem(PAYMENT_SESSION_KEY);
  } catch (error) {
    console.error('Error clearing payment session:', error);
  }
}

/**
 * Get stored payment session data
 * @returns PaymentSession object or null if not found
 */
export function getPaymentSession(): PaymentSession | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const sessionData = sessionStorage.getItem(PAYMENT_SESSION_KEY);
    if (!sessionData) return null;
    
    return JSON.parse(sessionData);
  } catch (error) {
    console.error('Error getting payment session:', error);
    return null;
  }
}

/**
 * useGamePayment Hook
 * Manages payment state and blockchain interactions for game entry payments
 */
export function useGamePayment(): UseGamePaymentReturn {
  const { address, isConnected } = useAccount();
  
  // State management
  const [hasActivePayment, setHasActivePayment] = useState<boolean>(false);
  const [paymentLoading, setPaymentLoading] = useState<boolean>(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentErrorCode, setPaymentErrorCode] = useState<string | null>(null);
  const [canRetryPayment, setCanRetryPayment] = useState<boolean>(true);
  const [ethPrice, setEthPrice] = useState<number | null>(null);
  const [requiredEth, setRequiredEth] = useState<bigint>(BigInt(0));
  const [sessionCreating, setSessionCreating] = useState<boolean>(false);
  const [sessionCreated, setSessionCreated] = useState<boolean>(false);
  
  // User tier state
  const [isStaker, setIsStaker] = useState<boolean>(false);
  const [isNFTHolder, setIsNFTHolder] = useState<boolean>(false);
  const [nftCount, setNftCount] = useState<number>(0);
  const [paymentTier, setPaymentTier] = useState<string>('regular');
  
  // Read payment amount from contract
  const {
    data: contractPaymentAmount,
    isLoading: isLoadingPaymentAmount,
  } = useReadContract({
    address: GAME_PAYMENT_CONTRACT.address,
    abi: GAME_PAYMENT_CONTRACT.abi,
    functionName: 'getPaymentAmount',
  });

  // Get user's ETH balance
  const { data: balanceData } = useBalance({
    address: address,
  });

  // Wagmi hooks for contract interaction
  const { 
    writeContract, 
    data: hash, 
    isPending: isWritePending,
    error: writeError 
  } = useWriteContract();
  
  const { 
    isLoading: isConfirming, 
    isSuccess: isConfirmed,
    error: confirmError 
  } = useWaitForTransactionReceipt({
    hash,
  });
  
  /**
   * Fetch ETH price on mount
   */
  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const price = await PriceOracle.getEthPrice();
        setEthPrice(price);
        setPaymentError(null);
        setPaymentErrorCode(null);
      } catch (error) {
        logPaymentError(error, {
          action: 'fetchEthPrice',
          message: 'Failed to fetch ETH price from oracle'
        });
        
        const parsedError = parsePaymentError(error);
        setPaymentError(parsedError.message);
        setPaymentErrorCode(ERROR_CODES.PRICE_FETCH_FAILED);
        setCanRetryPayment(true);
      }
    };
    
    fetchPrice();
  }, []);

  /**
   * Fetch payment amount based on user's NFT ownership (tier-based pricing)
   * Falls back to contract amount if API fails
   */
  useEffect(() => {
    const fetchPaymentAmount = async () => {
      if (!address) {
        // No wallet connected, use contract amount as fallback
        if (contractPaymentAmount && contractPaymentAmount > BigInt(0)) {
          setRequiredEth(contractPaymentAmount);
        }
        return;
      }
      
      try {
        // Fetch user-specific payment amount from API
        const response = await fetch('/api/payment-amount');
        
        if (!response.ok) {
          throw new Error('Failed to fetch payment amount');
        }
        
        const data = await response.json();
        
        // Update state with tier-specific data
        setRequiredEth(BigInt(data.payment_amount_wei));
        setIsStaker(data.is_staker || false);
        setIsNFTHolder(data.is_nft_holder);
        setNftCount(data.nft_count);
        setPaymentTier(data.tier);
        
        logger.payment('Payment amount fetched', {
          tier: data.tier,
          isStaker: data.is_staker,
          isNFTHolder: data.is_nft_holder,
          nftCount: data.nft_count,
          amount: data.payment_amount_wei,
        });
        
      } catch (error) {
        console.error('Error fetching payment amount:', error);
        
        // Fallback to contract amount
        if (contractPaymentAmount && contractPaymentAmount > BigInt(0)) {
          setRequiredEth(contractPaymentAmount);
          setPaymentTier('regular');
          setIsStaker(false);
          setIsNFTHolder(false);
          setNftCount(0);
        }
      }
    };
    
    fetchPaymentAmount();
  }, [address, contractPaymentAmount]);
  
  /**
   * Check payment status on mount and when wallet changes
   * Verify with server-side session
   */
  useEffect(() => {
    if (isConnected && address) {
      const verifyServerSession = async () => {
        try {
          // Check server-side session first
          const response = await fetch('/api/game-session');
          if (response.ok) {
            const data = await response.json();
            setHasActivePayment(data.hasActiveSession);
            
            // Sync local storage with server state
            if (data.hasActiveSession && data.session) {
              const localSession = getPaymentSession();
              if (!localSession || localSession.transactionHash !== data.session.transactionHash) {
                // Update local storage to match server
                storePaymentSession(
                  data.session.transactionHash,
                  '0', // Amount not needed for verification
                  address
                );
              }
            } else {
              // No server session, clear local storage
              clearPaymentSession();
            }
          } else {
            // Fallback to local check if server fails
            const hasPayment = checkPaymentStatus();
            setHasActivePayment(hasPayment);
            
            // Validate session belongs to current wallet
            if (hasPayment) {
              const session = getPaymentSession();
              if (session && session.walletAddress.toLowerCase() !== address.toLowerCase()) {
                clearPaymentSession();
                setHasActivePayment(false);
              }
            }
          }
        } catch (error) {
          console.error('Error verifying server session:', error);
          // Fallback to local check
          const hasPayment = checkPaymentStatus();
          setHasActivePayment(hasPayment);
        }
      };

      verifyServerSession();
    } else {
      setHasActivePayment(false);
    }
  }, [isConnected, address]);
  
  /**
   * NOTE: GAME_OVER session clearing is now handled in MarioGameConsoleV2
   * to ensure proper sequencing - score must be saved BEFORE session is cleared.
   * This prevents race conditions where the session gets deleted before the score
   * update API call completes (which requires an active session).
   * 
   * The hook still provides clearPaymentSession() for manual clearing when needed.
   */
  
  /**
   * Handle transaction confirmation and create server-side session
   */
  useEffect(() => {
    if (isConfirmed && hash && address) {
      const createServerSession = async () => {
        try {
          setSessionCreating(true);
          setSessionCreated(false);
          
          // Create server-side game session
          const response = await fetch('/api/game-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transactionHash: hash })
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create game session');
          }

          // Store payment session locally (for UI state)
          const ethAmount = GamePaymentService.formatEthAmount(requiredEth);
          storePaymentSession(hash, ethAmount, address);
          
          setSessionCreated(true);
          setSessionCreating(false);
          setHasActivePayment(true);
          setPaymentLoading(false);
          setPaymentError(null);
        } catch (error) {
          console.error('Error creating server session:', error);
          setPaymentError('Payment confirmed but failed to create game session. Please refresh.');
          setPaymentLoading(false);
          setSessionCreating(false);
          setSessionCreated(false);
        }
      };

      createServerSession();
    }
  }, [isConfirmed, hash, address, requiredEth]);
  
  /**
   * Handle write errors with enhanced error parsing
   */
  useEffect(() => {
    if (writeError) {
      setPaymentLoading(false);
      
      // Parse error using enhanced error handler
      const parsedError = parsePaymentError(writeError);
      setPaymentError(parsedError.message);
      setPaymentErrorCode(parsedError.code);
      setCanRetryPayment(parsedError.canRetry);
      
      // Log detailed error for debugging
      logPaymentError(writeError, {
        action: 'writeContract',
        code: parsedError.code,
        message: parsedError.message,
        canRetry: parsedError.canRetry,
        contractAddress: GAME_PAYMENT_CONTRACT.address,
        requiredEth: requiredEth.toString()
      });
    }
  }, [writeError]);
  
  /**
   * Handle confirmation errors with enhanced error parsing
   */
  useEffect(() => {
    if (confirmError) {
      setPaymentLoading(false);
      
      // Parse confirmation error
      const parsedError = parsePaymentError(confirmError);
      setPaymentError(parsedError.message);
      setPaymentErrorCode(ERROR_CODES.TRANSACTION_CONFIRMATION_FAILED);
      setCanRetryPayment(true);
      
      // Log detailed error for debugging
      logPaymentError(confirmError, {
        action: 'confirmTransaction',
        code: ERROR_CODES.TRANSACTION_CONFIRMATION_FAILED,
        message: parsedError.message,
        transactionHash: hash
      });
    }
  }, [confirmError]);
  
  /**
   * Update loading state based on transaction status
   */
  useEffect(() => {
    const isLoading = isWritePending || isConfirming;
    setPaymentLoading(isLoading);
  }, [isWritePending, isConfirming]);
  
  /**
   * Initiate payment transaction with comprehensive error handling
   * @returns Promise<boolean> - true if payment initiated successfully
   */
  const initiatePayment = useCallback(async (): Promise<boolean> => {
    // Validate wallet connection
    if (!isConnected || !address) {
      setPaymentError('Please connect your wallet');
      setPaymentErrorCode(ERROR_CODES.NOT_AUTHENTICATED);
      setCanRetryPayment(false);
      return false;
    }
    
    // Validate contract configuration
    if (!GamePaymentService.isContractConfigured()) {
      setPaymentError('Payment contract is not configured');
      setPaymentErrorCode(ERROR_CODES.CONTRACT_NOT_CONFIGURED);
      setCanRetryPayment(false);
      
      logger.error('Contract not configured', undefined, {
        action: 'initiatePayment',
        contractAddress: GAME_PAYMENT_CONTRACT.address
      });
      
      return false;
    }
    
    // Wait for payment amount to load if it's still loading
    let currentRequiredEth = requiredEth;
    if (currentRequiredEth === BigInt(0)) {
      setPaymentLoading(true);
      setPaymentError(null);
      
      // Fetch payment amount directly if not loaded yet
      try {
        const response = await fetch('/api/payment-amount');
        if (response.ok) {
          const data = await response.json();
          currentRequiredEth = BigInt(data.payment_amount_wei);
          setRequiredEth(currentRequiredEth);
          setIsStaker(data.is_staker || false);
          setIsNFTHolder(data.is_nft_holder);
          setNftCount(data.nft_count);
          setPaymentTier(data.tier);
        } else {
          // Fallback to contract amount
          if (contractPaymentAmount && contractPaymentAmount > BigInt(0)) {
            currentRequiredEth = contractPaymentAmount;
            setRequiredEth(currentRequiredEth);
          }
        }
      } catch (error) {
        console.error('Error fetching payment amount:', error);
        // Try to use contract amount as fallback
        if (contractPaymentAmount && contractPaymentAmount > BigInt(0)) {
          currentRequiredEth = contractPaymentAmount;
          setRequiredEth(currentRequiredEth);
        }
      }
      
      // If still not loaded, show error
      if (currentRequiredEth === BigInt(0)) {
        setPaymentLoading(false);
        setPaymentError('Failed to load payment amount. Please try again.');
        setPaymentErrorCode(ERROR_CODES.PRICE_FETCH_FAILED);
        setCanRetryPayment(true);
        return false;
      }
    }

    // Check if user has sufficient balance (payment + estimated gas)
    if (balanceData) {
      const userBalance = balanceData.value;
      // Estimate gas cost (rough estimate: 50000 gas * gas price)
      // For safety, we'll check if user has at least payment amount + 20% buffer for gas
      const estimatedGasBuffer = currentRequiredEth / BigInt(5); // 20% buffer
      const totalRequired = currentRequiredEth + estimatedGasBuffer;
      
      if (userBalance < totalRequired) {
        const shortfall = totalRequired - userBalance;
        setPaymentError(
          `Insufficient ETH balance. You need approximately ${GamePaymentService.formatEthAmount(totalRequired)} ETH (${GamePaymentService.formatEthAmount(currentRequiredEth)} for payment + gas fees). You have ${GamePaymentService.formatEthAmount(userBalance)} ETH. Please add at least ${GamePaymentService.formatEthAmount(shortfall)} ETH to your wallet.`
        );
        setPaymentErrorCode(ERROR_CODES.INSUFFICIENT_BALANCE);
        setCanRetryPayment(false);
        
        logger.error('Insufficient balance', undefined, {
          action: 'initiatePayment',
          userBalance: userBalance.toString(),
          requiredEth: currentRequiredEth.toString(),
          totalRequired: totalRequired.toString(),
          shortfall: shortfall.toString()
        });
        
        return false;
      }
    }
    
    try {
      setPaymentLoading(true);
      setPaymentError(null);
      setPaymentErrorCode(null);
      setCanRetryPayment(true);
      
      // Call payToPlay function with required ETH value
      writeContract({
        address: GAME_PAYMENT_CONTRACT.address,
        abi: GAME_PAYMENT_CONTRACT.abi,
        functionName: 'payToPlay',
        value: currentRequiredEth,
      });
      
      logger.payment('Payment initiated', {
        address,
        requiredEth: currentRequiredEth.toString(),
        ethPrice
      });
      
      return true;
    } catch (error) {
      setPaymentLoading(false);
      
      const parsedError = parsePaymentError(error);
      setPaymentError(parsedError.message);
      setPaymentErrorCode(parsedError.code);
      setCanRetryPayment(parsedError.canRetry);
      
      logPaymentError(error, {
        action: 'initiatePayment',
        code: parsedError.code,
        canRetry: parsedError.canRetry,
        address,
        requiredEth: currentRequiredEth.toString()
      });
      
      return false;
    }
  }, [isConnected, address, requiredEth, writeContract, balanceData, contractPaymentAmount, ethPrice]);
  
  /**
   * Clear payment session (exposed for external use)
   */
  const clearSession = useCallback(() => {
    clearPaymentSession();
    setHasActivePayment(false);
    // Reset session creation states to prevent modal auto-close on next open
    setSessionCreating(false);
    setSessionCreated(false);
  }, []);
  
  /**
   * Check payment status (exposed for external use)
   */
  const checkStatus = useCallback((): boolean => {
    const hasPayment = checkPaymentStatus();
    setHasActivePayment(hasPayment);
    return hasPayment;
  }, []);
  
  /**
   * Retry payment after error (clears error state and retries)
   */
  const retryPayment = useCallback(async (): Promise<boolean> => {
    setPaymentError(null);
    setPaymentErrorCode(null);
    return await initiatePayment();
  }, [initiatePayment]);
  
  return {
    hasActivePayment,
    paymentLoading,
    paymentError,
    paymentErrorCode,
    canRetryPayment,
    ethPrice,
    requiredEth,
    initiatePayment,
    clearPaymentSession: clearSession,
    checkPaymentStatus: checkStatus,
    retryPayment,
    sessionCreating,
    sessionCreated,
    isStaker,
    isNFTHolder,
    nftCount,
    paymentTier,
  };
}
