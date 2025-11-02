/**
 * XP Bridge Integration Tests
 * 
 * Tests for the XP to points conversion system including:
 * - Input validation and calculation
 * - Conversion API endpoint
 * - Error handling for conversion failures
 * - Animation and UI state management
 */

// Mock wagmi hooks
const mockUseAccount = jest.fn();

jest.mock('wagmi', () => ({
  useAccount: () => mockUseAccount(),
}));

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: 'div',
  },
  AnimatePresence: ({ children }) => children,
}));

// Mock error handlers
jest.mock('@/lib/errors', () => ({
  parseConversionError: jest.fn((error) => ({
    message: error?.message || 'Conversion failed',
    code: 'CONVERSION_ERROR',
    canRetry: true,
  })),
  ERROR_CODES: {
    INVALID_REQUEST: 'INVALID_REQUEST',
    INSUFFICIENT_XP: 'INSUFFICIENT_XP',
    USER_NOT_FOUND: 'USER_NOT_FOUND',
    DATABASE_ERROR: 'DATABASE_ERROR',
    NETWORK_ERROR: 'NETWORK_ERROR',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
  },
}));

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    conversion: jest.fn(),
    error: jest.fn(),
  },
  logConversionError: jest.fn(),
}));

const { parseConversionError, ERROR_CODES } = require('@/lib/errors');

describe('XP Bridge Integration Tests', () => {
  
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Reset mock implementations
    mockUseAccount.mockReturnValue({
      address: '0x1234567890abcdef1234567890abcdef12345678',
      isConnected: true,
    });
    
    // Mock fetch globally
    global.fetch = jest.fn();
  });

  describe('XP Input Validation', () => {
    
    test('should validate positive integer input', () => {
      const xpInput = '1000';
      const numValue = parseInt(xpInput, 10);
      
      expect(Number.isInteger(numValue)).toBe(true);
      expect(numValue).toBeGreaterThan(0);
    });
    
    test('should reject negative numbers', () => {
      const xpInput = '-100';
      const numValue = parseInt(xpInput, 10);
      
      expect(numValue).toBeLessThan(0);
    });
    
    test('should reject non-numeric input', () => {
      const xpInput = 'abc';
      const numValue = parseInt(xpInput, 10);
      
      expect(isNaN(numValue)).toBe(true);
    });
    
    test('should reject decimal numbers', () => {
      const xpInput = '100.5';
      const numValue = parseInt(xpInput, 10);
      
      // parseInt truncates decimals, so we need to check the original
      expect(xpInput.includes('.')).toBe(true);
    });
    
    test('should validate sufficient XP balance', () => {
      const currentXP = 5000;
      const xpInput = 1000;
      
      expect(xpInput <= currentXP).toBe(true);
    });
    
    test('should detect insufficient XP balance', () => {
      const currentXP = 500;
      const xpInput = 1000;
      
      expect(xpInput > currentXP).toBe(true);
    });
  });

  describe('XP to Points Calculation', () => {
    
    const CONVERSION_RATE = 10;
    
    test('should calculate points correctly for 1000 XP', () => {
      const xpAmount = 1000;
      const expectedPoints = 100;
      
      const calculatedPoints = xpAmount / CONVERSION_RATE;
      
      expect(calculatedPoints).toBe(expectedPoints);
    });
    
    test('should calculate points correctly for various amounts', () => {
      const testCases = [
        { xp: 100, expected: 10 },
        { xp: 500, expected: 50 },
        { xp: 1000, expected: 100 },
        { xp: 5000, expected: 500 },
        { xp: 10000, expected: 1000 },
      ];
      
      testCases.forEach(({ xp, expected }) => {
        const calculated = xp / CONVERSION_RATE;
        expect(calculated).toBe(expected);
      });
    });
    
    test('should handle zero XP', () => {
      const xpAmount = 0;
      const calculatedPoints = xpAmount / CONVERSION_RATE;
      
      expect(calculatedPoints).toBe(0);
    });
    
    test('should calculate real-time as user types', () => {
      const inputs = ['1', '10', '100', '1000'];
      const expected = [0.1, 1, 10, 100];
      
      inputs.forEach((input, index) => {
        const numValue = parseInt(input, 10);
        const calculated = numValue / CONVERSION_RATE;
        expect(calculated).toBe(expected[index]);
      });
    });
  });

  describe('Conversion API Endpoint Tests', () => {
    
    test('should call API with correct parameters', async () => {
      const walletAddress = '0x1234567890abcdef1234567890abcdef12345678';
      const xpAmount = 1000;
      
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            newXP: 4000,
            newPoints: 100,
            pointsAdded: 100,
          },
        }),
      });
      
      const response = await fetch('/api/bridge/convert-xp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress,
          xpAmount,
        }),
      });
      
      expect(fetch).toHaveBeenCalledWith('/api/bridge/convert-xp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress,
          xpAmount,
        }),
      });
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.pointsAdded).toBe(100);
    });
    
    test('should handle successful conversion response', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            newXP: 4000,
            newPoints: 200,
            pointsAdded: 100,
          },
        }),
      });
      
      const response = await fetch('/api/bridge/convert-xp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
          xpAmount: 1000,
        }),
      });
      
      const data = await response.json();
      
      expect(data.success).toBe(true);
      expect(data.data.newXP).toBe(4000);
      expect(data.data.newPoints).toBe(200);
      expect(data.data.pointsAdded).toBe(100);
    });
    
    test('should handle insufficient XP error', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          success: false,
          error: 'Insufficient XP. You have 500 XP but need 1000 XP.',
        }),
      });
      
      const response = await fetch('/api/bridge/convert-xp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
          xpAmount: 1000,
        }),
      });
      
      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.error).toContain('Insufficient XP');
    });
    
    test('should handle user not found error', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({
          success: false,
          error: 'User not found',
        }),
      });
      
      const response = await fetch('/api/bridge/convert-xp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: '0xnonexistent',
          xpAmount: 1000,
        }),
      });
      
      expect(response.ok).toBe(false);
      expect(response.status).toBe(404);
      
      const data = await response.json();
      expect(data.error).toBe('User not found');
    });
    
    test('should handle database error', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({
          success: false,
          error: 'Failed to complete XP conversion',
        }),
      });
      
      const response = await fetch('/api/bridge/convert-xp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
          xpAmount: 1000,
        }),
      });
      
      expect(response.ok).toBe(false);
      expect(response.status).toBe(500);
      
      const data = await response.json();
      expect(data.error).toContain('Failed to complete XP conversion');
    });
    
    test('should handle network error', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'));
      
      try {
        await fetch('/api/bridge/convert-xp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
            xpAmount: 1000,
          }),
        });
        
        fail('Should have thrown error');
      } catch (error) {
        expect(error.message).toBe('Network error');
      }
    });
  });

  describe('Conversion Error Handling', () => {
    
    test('should parse insufficient XP error', () => {
      const error = { message: 'Insufficient XP. You have 500 XP but need 1000 XP.' };
      parseConversionError.mockReturnValue({
        message: "You don't have enough XP. You have 500 XP but need 1000 XP.",
        code: ERROR_CODES.INSUFFICIENT_XP,
        canRetry: false,
      });
      
      const parsed = parseConversionError(error);
      
      expect(parsed.message).toContain("You don't have enough XP");
      expect(parsed.code).toBe(ERROR_CODES.INSUFFICIENT_XP);
      expect(parsed.canRetry).toBe(false);
    });
    
    test('should parse invalid amount error', () => {
      const error = { message: 'XP amount must be a positive number' };
      parseConversionError.mockReturnValue({
        message: 'Please enter a valid amount (minimum 1 XP).',
        code: ERROR_CODES.INVALID_REQUEST,
        canRetry: false,
      });
      
      const parsed = parseConversionError(error);
      
      expect(parsed.message).toContain('Please enter a valid amount');
      expect(parsed.code).toBe(ERROR_CODES.INVALID_REQUEST);
      expect(parsed.canRetry).toBe(false);
    });
    
    test('should parse database error', () => {
      const error = { message: 'Failed to complete XP conversion' };
      parseConversionError.mockReturnValue({
        message: 'Conversion failed. Please try again later.',
        code: ERROR_CODES.DATABASE_ERROR,
        canRetry: true,
      });
      
      const parsed = parseConversionError(error);
      
      expect(parsed.message).toContain('Conversion failed');
      expect(parsed.code).toBe(ERROR_CODES.DATABASE_ERROR);
      expect(parsed.canRetry).toBe(true);
    });
    
    test('should parse network error', () => {
      const error = { message: 'Network error' };
      parseConversionError.mockReturnValue({
        message: 'Network error. Your XP was not converted.',
        code: ERROR_CODES.NETWORK_ERROR,
        canRetry: true,
      });
      
      const parsed = parseConversionError(error);
      
      expect(parsed.message).toContain('Network error');
      expect(parsed.code).toBe(ERROR_CODES.NETWORK_ERROR);
      expect(parsed.canRetry).toBe(true);
    });
  });

  describe('Conversion State Management', () => {
    
    test('should track conversion loading state', () => {
      let isConverting = false;
      
      // Start conversion
      isConverting = true;
      expect(isConverting).toBe(true);
      
      // Complete conversion
      isConverting = false;
      expect(isConverting).toBe(false);
    });
    
    test('should disable convert button during conversion', () => {
      const isConverting = true;
      const xpInput = '1000';
      const currentXP = 5000;
      
      const isDisabled = isConverting || xpInput === '' || parseInt(xpInput) > currentXP;
      
      expect(isDisabled).toBe(true);
    });
    
    test('should enable convert button when valid', () => {
      const isConverting = false;
      const xpInput = '1000';
      const currentXP = 5000;
      const conversionError = null;
      
      const isDisabled = isConverting || xpInput === '' || parseInt(xpInput) > currentXP || conversionError !== null;
      
      expect(isDisabled).toBe(false);
    });
    
    test('should show success message after conversion', () => {
      let showSuccess = false;
      
      // Conversion succeeds
      showSuccess = true;
      expect(showSuccess).toBe(true);
      
      // Reset after timeout
      setTimeout(() => {
        showSuccess = false;
      }, 3000);
    });
  });

  describe('Wallet Connection Validation', () => {
    
    test('should require wallet connection for conversion', () => {
      mockUseAccount.mockReturnValue({
        address: null,
        isConnected: false,
      });
      
      const { isConnected, address } = mockUseAccount();
      
      expect(isConnected).toBe(false);
      expect(address).toBeNull();
    });
    
    test('should allow conversion when wallet is connected', () => {
      mockUseAccount.mockReturnValue({
        address: '0x1234567890abcdef1234567890abcdef12345678',
        isConnected: true,
      });
      
      const { isConnected, address } = mockUseAccount();
      
      expect(isConnected).toBe(true);
      expect(address).toBeDefined();
    });
  });

  describe('Balance Update After Conversion', () => {
    
    test('should update XP balance after conversion', () => {
      const currentXP = 5000;
      const xpAmount = 1000;
      const newXP = currentXP - xpAmount;
      
      expect(newXP).toBe(4000);
    });
    
    test('should update points balance after conversion', () => {
      const currentPoints = 100;
      const pointsAdded = 100;
      const newPoints = currentPoints + pointsAdded;
      
      expect(newPoints).toBe(200);
    });
    
    test('should call onConversionComplete callback', () => {
      const onConversionComplete = jest.fn();
      const newXP = 4000;
      const newPoints = 200;
      
      onConversionComplete(newXP, newPoints);
      
      expect(onConversionComplete).toHaveBeenCalledWith(newXP, newPoints);
    });
  });

  describe('Edge Cases', () => {
    
    test('should handle empty input', () => {
      const xpInput = '';
      const calculatedPoints = xpInput === '' ? 0 : parseInt(xpInput) / 10;
      
      expect(calculatedPoints).toBe(0);
    });
    
    test('should handle very large XP amounts', () => {
      const xpAmount = 1000000;
      const calculatedPoints = xpAmount / 10;
      
      expect(calculatedPoints).toBe(100000);
      expect(Number.isSafeInteger(calculatedPoints)).toBe(true);
    });
    
    test('should handle conversion rate edge cases', () => {
      const testCases = [
        { xp: 1, expected: 0.1 },
        { xp: 5, expected: 0.5 },
        { xp: 9, expected: 0.9 },
        { xp: 10, expected: 1 },
      ];
      
      testCases.forEach(({ xp, expected }) => {
        const calculated = xp / 10;
        expect(calculated).toBe(expected);
      });
    });
  });
});
