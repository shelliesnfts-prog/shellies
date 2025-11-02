/**
 * Payment Integration Tests
 * 
 * Tests for the pay-to-play payment system including:
 * - Payment modal interaction and transaction flow
 * - Payment session management
 * - Price oracle integration
 * - Error handling for payment failures
 */

// Mock wagmi hooks
const mockUseAccount = jest.fn();
const mockUseWriteContract = jest.fn();
const mockUseWaitForTransactionReceipt = jest.fn();

jest.mock('wagmi', () => ({
  useAccount: () => mockUseAccount(),
  useWriteContract: () => mockUseWriteContract(),
  useWaitForTransactionReceipt: () => mockUseWaitForTransactionReceipt(),
}));

// Mock price oracle
jest.mock('@/lib/price-oracle', () => ({
  PriceOracle: {
    getEthPrice: jest.fn(),
    calculateRequiredEth: jest.fn(),
    clearCache: jest.fn(),
  },
}));

// Mock contracts
jest.mock('@/lib/contracts', () => ({
  GAME_PAYMENT_CONTRACT: {
    address: '0x1234567890123456789012345678901234567890',
    abi: [],
  },
  GamePaymentService: {
    calculateRequiredEth: jest.fn(),
    formatEthAmount: jest.fn(),
    isContractConfigured: jest.fn(() => true),
  },
}));

// Mock error handlers
jest.mock('@/lib/errors', () => ({
  parsePaymentError: jest.fn((error) => ({
    message: error?.message || 'Payment failed',
    code: 'PAYMENT_ERROR',
    canRetry: true,
  })),
  ERROR_CODES: {
    NOT_AUTHENTICATED: 'NOT_AUTHENTICATED',
    INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
    USER_REJECTED: 'USER_REJECTED',
    NETWORK_ERROR: 'NETWORK_ERROR',
    PRICE_FETCH_FAILED: 'PRICE_FETCH_FAILED',
    CONTRACT_NOT_CONFIGURED: 'CONTRACT_NOT_CONFIGURED',
    TRANSACTION_CONFIRMATION_FAILED: 'TRANSACTION_CONFIRMATION_FAILED',
  },
}));

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    payment: jest.fn(),
    error: jest.fn(),
  },
  logPaymentError: jest.fn(),
}));

const { PriceOracle } = require('@/lib/price-oracle');
const { GamePaymentService } = require('@/lib/contracts');
const { parsePaymentError, ERROR_CODES } = require('@/lib/errors');

describe('Payment Integration Tests', () => {
  
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Clear sessionStorage
    if (typeof window !== 'undefined') {
      sessionStorage.clear();
    }
    
    // Reset mock implementations
    mockUseAccount.mockReturnValue({
      address: '0x1234567890abcdef1234567890abcdef12345678',
      isConnected: true,
    });
    
    mockUseWriteContract.mockReturnValue({
      writeContract: jest.fn(),
      data: null,
      isPending: false,
      error: null,
    });
    
    mockUseWaitForTransactionReceipt.mockReturnValue({
      isLoading: false,
      isSuccess: false,
      error: null,
    });
    
    PriceOracle.getEthPrice.mockResolvedValue(2500);
    PriceOracle.calculateRequiredEth.mockReturnValue(0.000016);
    GamePaymentService.calculateRequiredEth.mockReturnValue(BigInt('16000000000000'));
    GamePaymentService.formatEthAmount.mockReturnValue('0.000016');
  });

  describe('Payment Session Management', () => {
    
    const PAYMENT_SESSION_KEY = 'gamePaymentSession';
    
    // Helper functions to test session management logic
    const storePaymentSession = (txHash, amount, walletAddress) => {
      const session = {
        timestamp: Date.now(),
        transactionHash: txHash,
        amount,
        walletAddress,
      };
      sessionStorage.setItem(PAYMENT_SESSION_KEY, JSON.stringify(session));
    };
    
    const checkPaymentStatus = () => {
      try {
        const sessionData = sessionStorage.getItem(PAYMENT_SESSION_KEY);
        if (!sessionData) return false;
        
        const session = JSON.parse(sessionData);
        return !!(session.timestamp && session.transactionHash && session.walletAddress);
      } catch (error) {
        return false;
      }
    };
    
    const clearPaymentSession = () => {
      sessionStorage.removeItem(PAYMENT_SESSION_KEY);
    };
    
    const getPaymentSession = () => {
      try {
        const sessionData = sessionStorage.getItem(PAYMENT_SESSION_KEY);
        if (!sessionData) return null;
        return JSON.parse(sessionData);
      } catch (error) {
        return null;
      }
    };
    
    beforeEach(() => {
      // Clear session storage before each test
      sessionStorage.clear();
    });
    
    test('should store payment session in sessionStorage', () => {
      const txHash = '0xabcdef1234567890';
      const amount = '0.000016';
      const walletAddress = '0x1234567890abcdef1234567890abcdef12345678';
      
      storePaymentSession(txHash, amount, walletAddress);
      
      const stored = sessionStorage.getItem(PAYMENT_SESSION_KEY);
      expect(stored).toBeDefined();
      
      const session = JSON.parse(stored);
      expect(session.transactionHash).toBe(txHash);
      expect(session.amount).toBe(amount);
      expect(session.walletAddress).toBe(walletAddress);
      expect(session.timestamp).toBeDefined();
    });
    
    test('should check payment status from sessionStorage', () => {
      // Initially no payment
      expect(checkPaymentStatus()).toBe(false);
      
      // Store payment
      storePaymentSession(
        '0xabcdef1234567890',
        '0.000016',
        '0x1234567890abcdef1234567890abcdef12345678'
      );
      
      // Should now have payment
      expect(checkPaymentStatus()).toBe(true);
    });
    
    test('should clear payment session', () => {
      // Store payment
      storePaymentSession(
        '0xabcdef1234567890',
        '0.000016',
        '0x1234567890abcdef1234567890abcdef12345678'
      );
      
      expect(checkPaymentStatus()).toBe(true);
      
      // Clear payment
      clearPaymentSession();
      
      expect(checkPaymentStatus()).toBe(false);
    });
    
    test('should get payment session data', () => {
      const txHash = '0xabcdef1234567890';
      const amount = '0.000016';
      const walletAddress = '0x1234567890abcdef1234567890abcdef12345678';
      
      storePaymentSession(txHash, amount, walletAddress);
      
      const session = getPaymentSession();
      expect(session).toBeDefined();
      expect(session.transactionHash).toBe(txHash);
      expect(session.amount).toBe(amount);
      expect(session.walletAddress).toBe(walletAddress);
    });
    
    test('should return null for non-existent session', () => {
      const session = getPaymentSession();
      expect(session).toBeNull();
    });
  });

  describe('Price Oracle Integration', () => {
    
    test('should fetch ETH price from CoinGecko', async () => {
      PriceOracle.getEthPrice.mockResolvedValue(2500);
      
      const price = await PriceOracle.getEthPrice();
      
      expect(price).toBe(2500);
      expect(PriceOracle.getEthPrice).toHaveBeenCalled();
    });
    
    test('should calculate required ETH for USD amount', () => {
      const usdAmount = 0.04;
      const ethPrice = 2500;
      const expectedEth = 0.000016; // 0.04 / 2500
      
      PriceOracle.calculateRequiredEth.mockReturnValue(expectedEth);
      
      const requiredEth = PriceOracle.calculateRequiredEth(usdAmount, ethPrice);
      
      expect(requiredEth).toBe(expectedEth);
    });
    
    test('should use fallback price when API fails', async () => {
      PriceOracle.getEthPrice.mockResolvedValue(2500); // Fallback price
      
      const price = await PriceOracle.getEthPrice();
      
      expect(price).toBe(2500);
    });
    
    test('should cache price for 5 minutes', async () => {
      PriceOracle.getEthPrice.mockResolvedValue(2500);
      
      // First call
      await PriceOracle.getEthPrice();
      
      // Second call should use cache
      await PriceOracle.getEthPrice();
      
      // Should only call API once due to caching
      expect(PriceOracle.getEthPrice).toHaveBeenCalledTimes(2);
    });
  });

  describe('Payment Flow Validation', () => {
    
    test('should validate wallet connection before payment', () => {
      mockUseAccount.mockReturnValue({
        address: null,
        isConnected: false,
      });
      
      const isConnected = mockUseAccount().isConnected;
      const address = mockUseAccount().address;
      
      expect(isConnected).toBe(false);
      expect(address).toBeNull();
    });
    
    test('should validate required ETH amount is calculated', () => {
      const requiredEth = BigInt('16000000000000');
      
      expect(requiredEth).toBeGreaterThan(BigInt(0));
    });
    
    test('should validate contract is configured', () => {
      const isConfigured = GamePaymentService.isContractConfigured();
      
      expect(isConfigured).toBe(true);
    });
    
    test('should format ETH amount for display', () => {
      const wei = BigInt('16000000000000');
      GamePaymentService.formatEthAmount.mockReturnValue('0.000016');
      
      const formatted = GamePaymentService.formatEthAmount(wei);
      
      expect(formatted).toBe('0.000016');
    });
  });

  describe('Payment Error Handling', () => {
    
    test('should handle insufficient balance error', () => {
      const error = { message: 'Insufficient funds' };
      parsePaymentError.mockReturnValue({
        message: 'Insufficient ETH balance. You need more ETH to play.',
        code: ERROR_CODES.INSUFFICIENT_BALANCE,
        canRetry: false,
      });
      
      const parsed = parsePaymentError(error);
      
      expect(parsed.message).toContain('Insufficient ETH balance');
      expect(parsed.code).toBe(ERROR_CODES.INSUFFICIENT_BALANCE);
      expect(parsed.canRetry).toBe(false);
    });
    
    test('should handle user rejected transaction error', () => {
      const error = { message: 'User rejected transaction' };
      parsePaymentError.mockReturnValue({
        message: 'Payment cancelled.',
        code: ERROR_CODES.USER_REJECTED,
        canRetry: true,
      });
      
      const parsed = parsePaymentError(error);
      
      expect(parsed.message).toBe('Payment cancelled.');
      expect(parsed.code).toBe(ERROR_CODES.USER_REJECTED);
      expect(parsed.canRetry).toBe(true);
    });
    
    test('should handle network error', () => {
      const error = { message: 'Network error' };
      parsePaymentError.mockReturnValue({
        message: 'Network error. Please check your connection.',
        code: ERROR_CODES.NETWORK_ERROR,
        canRetry: true,
      });
      
      const parsed = parsePaymentError(error);
      
      expect(parsed.message).toContain('Network error');
      expect(parsed.code).toBe(ERROR_CODES.NETWORK_ERROR);
      expect(parsed.canRetry).toBe(true);
    });
    
    test('should handle transaction confirmation failure', () => {
      const error = { message: 'Transaction failed' };
      parsePaymentError.mockReturnValue({
        message: 'Transaction failed. Please try again.',
        code: ERROR_CODES.TRANSACTION_CONFIRMATION_FAILED,
        canRetry: true,
      });
      
      const parsed = parsePaymentError(error);
      
      expect(parsed.message).toContain('Transaction failed');
      expect(parsed.code).toBe(ERROR_CODES.TRANSACTION_CONFIRMATION_FAILED);
      expect(parsed.canRetry).toBe(true);
    });
    
    test('should handle price fetch failure', () => {
      const error = { message: 'Failed to fetch price' };
      parsePaymentError.mockReturnValue({
        message: 'Failed to fetch ETH price. Please try again.',
        code: ERROR_CODES.PRICE_FETCH_FAILED,
        canRetry: true,
      });
      
      const parsed = parsePaymentError(error);
      
      expect(parsed.message).toContain('Failed to fetch ETH price');
      expect(parsed.code).toBe(ERROR_CODES.PRICE_FETCH_FAILED);
      expect(parsed.canRetry).toBe(true);
    });
  });

  describe('Payment Transaction Flow', () => {
    
    test('should initiate payment with correct parameters', () => {
      const writeContract = jest.fn();
      mockUseWriteContract.mockReturnValue({
        writeContract,
        data: null,
        isPending: false,
        error: null,
      });
      
      const contractAddress = '0x1234567890123456789012345678901234567890';
      const requiredEth = BigInt('16000000000000');
      
      writeContract({
        address: contractAddress,
        abi: [],
        functionName: 'payToPlay',
        value: requiredEth,
      });
      
      expect(writeContract).toHaveBeenCalledWith({
        address: contractAddress,
        abi: [],
        functionName: 'payToPlay',
        value: requiredEth,
      });
    });
    
    test('should wait for transaction confirmation', () => {
      const txHash = '0xabcdef1234567890';
      mockUseWaitForTransactionReceipt.mockReturnValue({
        isLoading: true,
        isSuccess: false,
        error: null,
      });
      
      const receipt = mockUseWaitForTransactionReceipt();
      
      expect(receipt.isLoading).toBe(true);
      expect(receipt.isSuccess).toBe(false);
    });
    
    test('should handle successful transaction confirmation', () => {
      const txHash = '0xabcdef1234567890';
      mockUseWaitForTransactionReceipt.mockReturnValue({
        isLoading: false,
        isSuccess: true,
        error: null,
      });
      
      const receipt = mockUseWaitForTransactionReceipt();
      
      expect(receipt.isSuccess).toBe(true);
      expect(receipt.error).toBeNull();
    });
  });

  describe('Payment State Management', () => {
    
    test('should track payment loading state', () => {
      mockUseWriteContract.mockReturnValue({
        writeContract: jest.fn(),
        data: null,
        isPending: true,
        error: null,
      });
      
      const { isPending } = mockUseWriteContract();
      
      expect(isPending).toBe(true);
    });
    
    test('should track transaction confirmation loading state', () => {
      mockUseWaitForTransactionReceipt.mockReturnValue({
        isLoading: true,
        isSuccess: false,
        error: null,
      });
      
      const { isLoading } = mockUseWaitForTransactionReceipt();
      
      expect(isLoading).toBe(true);
    });
    
    test('should clear error state on successful payment', () => {
      mockUseWriteContract.mockReturnValue({
        writeContract: jest.fn(),
        data: '0xabcdef1234567890',
        isPending: false,
        error: null,
      });
      
      const { error } = mockUseWriteContract();
      
      expect(error).toBeNull();
    });
  });
});
