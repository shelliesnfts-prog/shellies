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