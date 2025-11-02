/**
 * Logging utility for debugging and error tracking
 * Provides structured logging with different levels and context
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

interface LogContext {
  [key: string]: any;
}

/**
 * Logger class for structured logging
 */
class Logger {
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }

  /**
   * Format log message with timestamp and context
   */
  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` | Context: ${JSON.stringify(context)}` : '';
    return `[${timestamp}] [${level}] ${message}${contextStr}`;
  }

  /**
   * Log debug messages (only in development)
   */
  debug(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      console.debug(this.formatMessage(LogLevel.DEBUG, message, context));
    }
  }

  /**
   * Log info messages
   */
  info(message: string, context?: LogContext): void {
    console.info(this.formatMessage(LogLevel.INFO, message, context));
  }

  /**
   * Log warning messages
   */
  warn(message: string, context?: LogContext): void {
    console.warn(this.formatMessage(LogLevel.WARN, message, context));
  }

  /**
   * Log error messages with full error details
   */
  error(message: string, error?: any, context?: LogContext): void {
    const errorDetails = error ? {
      message: error.message,
      stack: error.stack,
      code: error.code,
      ...context,
    } : context;

    console.error(this.formatMessage(LogLevel.ERROR, message, errorDetails));
  }

  /**
   * Log payment-related events
   */
  payment(event: string, details: LogContext): void {
    this.info(`Payment: ${event}`, details);
  }

  /**
   * Log conversion-related events
   */
  conversion(event: string, details: LogContext): void {
    this.info(`Conversion: ${event}`, details);
  }

  /**
   * Log transaction events
   */
  transaction(event: string, details: LogContext): void {
    this.info(`Transaction: ${event}`, details);
  }
}

// Export singleton instance
export const logger = new Logger();

// Export convenience functions
export const logPaymentError = (error: any, context?: LogContext) => {
  logger.error('Payment Error', error, {
    ...context,
    timestamp: Date.now(),
  });
};

export const logConversionError = (error: any, context?: LogContext) => {
  logger.error('Conversion Error', error, {
    ...context,
    timestamp: Date.now(),
  });
};

export const logTransactionError = (error: any, context?: LogContext) => {
  logger.error('Transaction Error', error, {
    ...context,
    timestamp: Date.now(),
  });
};
