// Error handling classes and types for the raffle system

export class ValidationError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code: string, statusCode: number = 400) {
    super(message);
    this.name = 'ValidationError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class NotFoundError extends ValidationError {
  constructor(message: string, code: string) {
    super(message, code, 404);
    this.name = 'NotFoundError';
  }
}

export class AuthenticationError extends ValidationError {
  constructor(message: string = 'Not authenticated') {
    super(message, 'NOT_AUTHENTICATED', 401);
    this.name = 'AuthenticationError';
  }
}

// Error codes for consistent error handling
export const ERROR_CODES = {
  // Authentication
  NOT_AUTHENTICATED: 'NOT_AUTHENTICATED',
  
  // Raffle errors
  RAFFLE_NOT_FOUND: 'RAFFLE_NOT_FOUND',
  RAFFLE_ENDED: 'RAFFLE_ENDED',
  
  // User errors
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  INSUFFICIENT_POINTS: 'INSUFFICIENT_POINTS',
  
  // Ticket errors
  INVALID_TICKET_COUNT: 'INVALID_TICKET_COUNT',
  MAX_TICKETS_EXCEEDED: 'MAX_TICKETS_EXCEEDED',
  NO_REMAINING_TICKETS: 'NO_REMAINING_TICKETS',
  
  // General
  INVALID_REQUEST: 'INVALID_REQUEST',
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
} as const;

// Type for error responses
export interface ErrorResponse {
  success: false;
  error: string;
  message: string;
  code: string;
}

// Type for success responses
export interface SuccessResponse<T = any> {
  success: true;
  message: string;
  data: T;
}

// Helper function to create error responses
export function createErrorResponse(error: ValidationError): ErrorResponse {
  return {
    success: false,
    error: error.message,
    message: getUserFriendlyMessage(error.code),
    code: error.code
  };
}

// Helper function to create success responses
export function createSuccessResponse<T>(message: string, data: T): SuccessResponse<T> {
  return {
    success: true,
    message,
    data
  };
}

// User-friendly error messages
function getUserFriendlyMessage(code: string): string {
  const messages: Record<string, string> = {
    [ERROR_CODES.NOT_AUTHENTICATED]: 'Please connect your wallet to continue',
    [ERROR_CODES.RAFFLE_NOT_FOUND]: 'This raffle no longer exists',
    [ERROR_CODES.RAFFLE_ENDED]: 'This raffle has already ended',
    [ERROR_CODES.USER_NOT_FOUND]: 'Please connect your wallet first',
    [ERROR_CODES.INSUFFICIENT_POINTS]: 'You don\'t have enough SHELL points',
    [ERROR_CODES.INVALID_TICKET_COUNT]: 'Please enter a valid number of tickets',
    [ERROR_CODES.MAX_TICKETS_EXCEEDED]: 'You\'ve reached the maximum tickets for this raffle',
    [ERROR_CODES.NO_REMAINING_TICKETS]: 'No remaining tickets available for you',
    [ERROR_CODES.INVALID_REQUEST]: 'Invalid request data',
    [ERROR_CODES.DATABASE_ERROR]: 'Database operation failed',
    [ERROR_CODES.INTERNAL_ERROR]: 'An unexpected error occurred'
  };

  return messages[code] || 'An error occurred';
}

// Parse contract/transaction errors and return user-friendly messages
export function parseContractError(error: any): string {
  // Handle common error patterns
  if (!error || typeof error !== 'object') {
    return 'Transaction failed. Please try again.';
  }

  const errorString = error.message || error.toString() || '';
  const errorStringLower = errorString.toLowerCase();

  // User rejected transaction
  if (errorStringLower.includes('user rejected') || 
      errorStringLower.includes('user denied') ||
      errorStringLower.includes('user cancelled')) {
    return 'Transaction was cancelled by user';
  }

  // Insufficient gas/funds
  if (errorStringLower.includes('insufficient funds') || 
      errorStringLower.includes('insufficient balance') ||
      errorStringLower.includes('insufficient gas') ||
      errorStringLower.includes('out of gas')) {
    return 'Insufficient gas or funds to complete transaction';
  }

  // Network issues
  if (errorStringLower.includes('network') || 
      errorStringLower.includes('connection') ||
      errorStringLower.includes('timeout')) {
    return 'Network error. Please check your connection and try again.';
  }

  // Contract execution failed
  if (errorStringLower.includes('execution reverted') || 
      errorStringLower.includes('transaction failed') ||
      errorStringLower.includes('call exception')) {
    return 'Transaction failed. Please check raffle requirements and try again.';
  }

  // Nonce issues
  if (errorStringLower.includes('nonce') || 
      errorStringLower.includes('replacement transaction')) {
    return 'Transaction conflict. Please wait a moment and try again.';
  }

  // Gas price issues
  if (errorStringLower.includes('gas price') || 
      errorStringLower.includes('underpriced')) {
    return 'Gas price too low. Please adjust gas settings and try again.';
  }

  // Chain/network mismatch
  if (errorStringLower.includes('chain') || 
      errorStringLower.includes('wrong network')) {
    return 'Wrong network selected. Please switch to the correct network.';
  }

  // Default fallback for unknown errors
  return 'Transaction failed. Please try again.';
}