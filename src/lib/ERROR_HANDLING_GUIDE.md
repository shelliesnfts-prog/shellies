# Error Handling Guide

This document describes the comprehensive error handling system implemented across the payment and XP conversion features.

## Overview

The error handling system provides:
- **Structured error types** with error codes
- **User-friendly error messages** for all scenarios
- **Retry mechanisms** for recoverable errors
- **Detailed logging** for debugging
- **Reusable error display components**

## Error Types

### Payment Errors

| Error Code | Description | Can Retry | User Message |
|------------|-------------|-----------|--------------|
| `PAYMENT_FAILED` | Generic payment failure | Yes | Payment transaction failed. Please try again. |
| `INSUFFICIENT_BALANCE` | Not enough ETH | No | Insufficient ETH balance to complete payment |
| `USER_REJECTED_TRANSACTION` | User cancelled in wallet | Yes | Transaction was cancelled |
| `NETWORK_ERROR` | Network/connection issue | Yes | Network error. Please check your connection. |
| `WRONG_NETWORK` | Not on Ink network | Yes | Please switch to Ink network |
| `PRICE_FETCH_FAILED` | Can't get ETH price | Yes | Failed to fetch current ETH price |
| `CONTRACT_NOT_CONFIGURED` | Missing contract config | No | Payment contract is not configured |
| `TRANSACTION_CONFIRMATION_FAILED` | Tx didn't confirm | Yes | Transaction confirmation failed |

### XP Conversion Errors

| Error Code | Description | Can Retry | User Message |
|------------|-------------|-----------|--------------|
| `INSUFFICIENT_XP` | Not enough XP | No | You don't have enough XP for this conversion |
| `INVALID_XP_AMOUNT` | Invalid input | No | Please enter a valid XP amount |
| `CONVERSION_FAILED` | Generic conversion failure | Yes | XP conversion failed. Please try again. |
| `DATABASE_ERROR` | Database operation failed | Yes | Database operation failed |
| `NETWORK_ERROR` | Network/connection issue | Yes | Network error. Please check your connection. |

## Components

### ErrorDisplay Component

Location: `src/components/ErrorDisplay.tsx`

A reusable component for displaying errors with:
- Different severity levels (error, warning, info)
- Optional retry button
- Optional dismiss button
- Animated entrance/exit

**Usage:**
```tsx
<ErrorDisplay
  message="Payment failed"
  severity="error"
  onRetry={handleRetry}
  canRetry={true}
/>
```

### Error Parsing Functions

Location: `src/lib/errors.ts`

#### `parsePaymentError(error: any)`
Parses payment-related errors and returns:
- `message`: User-friendly error message
- `code`: Error code for tracking
- `canRetry`: Whether the error is recoverable

#### `parseConversionError(error: any)`
Parses XP conversion errors and returns the same structure.

## Logging

Location: `src/lib/logger.ts`

### Logger Methods

- `logger.debug(message, context)` - Debug logs (dev only)
- `logger.info(message, context)` - Info logs
- `logger.warn(message, context)` - Warning logs
- `logger.error(message, error, context)` - Error logs with stack traces
- `logger.payment(event, details)` - Payment-specific logs
- `logger.conversion(event, details)` - Conversion-specific logs
- `logger.transaction(event, details)` - Transaction-specific logs

### Convenience Functions

- `logPaymentError(error, context)` - Log payment errors
- `logConversionError(error, context)` - Log conversion errors
- `logTransactionError(error, context)` - Log transaction errors

**Usage:**
```typescript
import { logPaymentError } from '@/lib/logger';

try {
  // ... payment logic
} catch (error) {
  logPaymentError(error, {
    action: 'initiatePayment',
    address: userAddress,
    amount: requiredEth.toString()
  });
}
```

## Implementation Examples

### Payment Flow with Error Handling

```typescript
const {
  hasActivePayment,
  paymentLoading,
  paymentError,
  paymentErrorCode,
  canRetryPayment,
  initiatePayment,
  retryPayment,
} = useGamePayment();

// In component
{paymentError && (
  <ErrorDisplay
    message={paymentError}
    severity="error"
    onRetry={canRetryPayment ? retryPayment : undefined}
    canRetry={canRetryPayment}
  />
)}
```

### XP Conversion with Error Handling

```typescript
const handleConvert = async () => {
  try {
    const response = await fetch('/api/bridge/convert-xp', {
      method: 'POST',
      body: JSON.stringify({ walletAddress, xpAmount }),
    });

    const data = await response.json();

    if (!response.ok) {
      const parsedError = parseConversionError({ message: data.error });
      setConversionError(parsedError.message);
      setCanRetryConversion(parsedError.canRetry);
      
      logConversionError({ message: data.error }, {
        action: 'convertXP',
        status: response.status,
        walletAddress,
        xpAmount
      });
      
      return;
    }

    // Handle success
    logger.conversion('XP converted successfully', {
      walletAddress,
      xpAmount,
      pointsAdded: data.data.pointsAdded
    });
    
  } catch (error) {
    const parsedError = parseConversionError(error);
    setConversionError(parsedError.message);
    
    logConversionError(error, {
      action: 'convertXP',
      walletAddress,
      xpAmount
    });
  }
};
```

## Best Practices

1. **Always parse errors** using `parsePaymentError` or `parseConversionError`
2. **Log all errors** with context for debugging
3. **Show user-friendly messages** using the ErrorDisplay component
4. **Provide retry options** for recoverable errors
5. **Include context** in logs (wallet address, amounts, transaction hashes)
6. **Handle all error scenarios** (network, validation, contract, etc.)
7. **Test error flows** to ensure proper user experience

## Testing Error Scenarios

### Payment Errors
- Disconnect wallet during payment
- Switch to wrong network
- Reject transaction in wallet
- Insufficient ETH balance
- Network disconnection

### Conversion Errors
- Enter amount > available XP
- Enter invalid amount (negative, decimal)
- Disconnect during conversion
- Network disconnection
- Database errors (simulate with invalid data)

## Monitoring

All errors are logged to the console with:
- Timestamp
- Error code
- Error message
- Context (wallet address, amounts, etc.)
- Stack trace (for unexpected errors)

In production, these logs can be sent to a monitoring service like Sentry or LogRocket.
