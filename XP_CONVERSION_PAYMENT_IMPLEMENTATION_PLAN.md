# XP to Points Conversion with Payment - Implementation Plan

## Overview
Implement a paid XP conversion system where users pay 0.1 USD to convert 1000 XP to 100 points. The system uses blockchain transaction verification as the source of truth to prevent double-spending and ensure security.

## Current System Analysis

### Existing Components
1. **Smart Contract**: `GamePaymentContract.sol` - Has `payToPlay()` function
2. **XP Bridge UI**: `src/components/XPBridge.tsx` - Currently shows "Coming Soon"
3. **API Endpoint**: `src/app/api/bridge/convert-xp/route.ts` - Has 7-day cooldown logic
4. **Database**: `shellies_raffle_users` table with `last_convert` column
5. **Conversion Rate**: 1000 XP = 100 points (divide by 10)

### Current Flow Issues
- No payment requirement before conversion
- No transaction verification
- 7-day cooldown will be deprecated (payment is the new rate limiter)
- No protection against replay attacks

## New Implementation Plan

### Phase 1: Smart Contract Updates

#### 1.1 Add `payToConvertXP()` Function to GamePaymentContract.sol

```solidity
// New event for XP conversion payments
event XPConversionPayment(
    address indexed player, 
    uint256 amount, 
    uint256 timestamp
);

// New function for XP conversion payment
function payToConvertXP() external payable {
    require(msg.value > 0, "Payment amount must be greater than 0");
    totalCollected += msg.value;
    emit XPConversionPayment(msg.sender, msg.value, block.timestamp);
}
```

**Key Features**:
- Separate event from `payToPlay()` for tracking
- Accepts any payment amount (flexible for USD price changes)
- Emits transaction details for verification

#### 1.2 Update ABI File
- Add new function and event to `src/lib/game-payment-abi.ts`

---

### Phase 2: Database Schema Updates

#### 2.1 Modify `last_convert` Column Usage
The existing `last_convert` column will now store the timestamp of the **last verified payment transaction**, not just the last conversion attempt.

**Important Change**: The 7-day cooldown logic will be **removed**. Since users pay 0.1 USD per conversion, they can convert as many times as they want (as long as they pay each time and have sufficient XP).

**Migration**: No schema changes needed, just usage pattern change:
- **Before**: Used to enforce 7-day cooldown
- **After**: Used only to prevent replay attacks (transaction timestamp comparison)

---

### Phase 3: Frontend Implementation

#### 3.1 Update XPBridge Component (`src/components/XPBridge.tsx`)

**Remove Cooldown Logic**:
```typescript
// REMOVE these cooldown-related states and effects:
// - canConvert state (based on 7-day cooldown)
// - secondsUntilNextConvert state
// - Countdown timer effect
// - formatCountdown function
// - Cooldown display in UI
```

**New State Variables**:
```typescript
const [paymentTxHash, setPaymentTxHash] = useState<string | null>(null);
const [isPaymentPending, setIsPaymentPending] = useState(false);
const [paymentError, setPaymentError] = useState<string | null>(null);
```

**New Flow**:
1. User clicks "Convert XP" button
2. Trigger blockchain transaction to `payToConvertXP()`
3. Wait for transaction confirmation
4. Store `txHash` + metadata in localStorage as `pendingConversionTx`
5. Call API endpoint with `txHash`
6. API verifies transaction and converts XP
7. Clear localStorage on success

**Recovery Flow** (if interrupted):
1. User returns to profile page
2. Component checks localStorage for `pendingConversionTx`
3. If found, fetch user's `last_convert` from API
4. Compare: `pending.timestamp > last_convert`?
5. If YES: Show "Resume Conversion" button
6. If NO: Clear localStorage (already processed)
7. User clicks "Resume" → Call API with existing txHash
8. Success → Clear localStorage

**Implementation Steps**:
- Add wagmi hooks for contract interaction
- Implement payment transaction flow
- Add loading states for payment + conversion
- Store txHash + metadata in localStorage for recovery
- Add recovery check on component mount
- Show "Resume Conversion" UI if pending transaction found
- Implement resume conversion function
- Handle transaction errors gracefully
- Auto-clear old pending conversions (>24 hours)

#### 3.2 Contract Interaction Utility

Create or update contract service to interact with `payToConvertXP()`:

```typescript
// src/lib/game-payment-service.ts
import { writeContract, waitForTransactionReceipt } from '@wagmi/core';
import { parseEther } from 'viem';

export async function payForXPConversion(
  amountInUSD: number,
  ethPriceInUSD: number
): Promise<string> {
  // Calculate ETH amount based on current price
  const ethAmount = amountInUSD / ethPriceInUSD;
  
  // Call contract
  const hash = await writeContract({
    address: process.env.NEXT_PUBLIC_GAME_PAYMENT_CONTRACT,
    abi: game_payment_abi,
    functionName: 'payToConvertXP',
    value: parseEther(ethAmount.toString())
  });
  
  // Wait for confirmation
  await waitForTransactionReceipt({ hash });
  
  return hash;
}
```

---

### Phase 4: Backend API Updates

#### 4.1 Update Convert XP Endpoint (`src/app/api/bridge/convert-xp/route.ts`)

**New Request Interface**:
```typescript
interface ConvertXPRequest {
  xpAmount: number;
  txHash: string; // NEW: Required transaction hash
  // walletAddress removed - get from session instead
}
```

**New Verification Flow**:

```typescript
// Step 1: Get authenticated user from session
const session = await getServerSession(authOptions);
if (!session?.address) {
  throw new ValidationError('Not authenticated', ERROR_CODES.UNAUTHORIZED, 401);
}
const authenticatedWallet = session.address as string;

// Step 2: Validate txHash is provided
const { txHash, xpAmount } = await request.json();
if (!txHash || typeof txHash !== 'string') {
  throw new ValidationError('Transaction hash is required');
}

// Step 3: Fetch transaction data from blockchain
const txData = await verifyConversionPayment(txHash, authenticatedWallet);

// Step 3: Check if transaction is valid
if (!txData.isValid) {
  throw new ValidationError('Invalid transaction');
}

// Step 4: Check last_convert timestamp vs transaction timestamp
// NOTE: 7-day cooldown is REMOVED - users can convert anytime if they pay
const { data: user } = await supabaseService
  .from('shellies_raffle_users')
  .select('last_convert, game_score, points')
  .eq('wallet_address', walletAddress)
  .single();

if (user.last_convert) {
  // IMPORTANT: Timezone-safe comparison
  // - Blockchain timestamp: Unix seconds (UTC)
  // - Database TIMESTAMPTZ: Stored as UTC internally
  // - .getTime(): Returns UTC milliseconds since epoch
  // - Both converted to UTC milliseconds for safe comparison
  
  const lastConvertTime = new Date(user.last_convert).getTime(); // UTC milliseconds
  const txTime = txData.timestamp * 1000; // Convert blockchain seconds to milliseconds
  
  // Only check if transaction is NEWER than last conversion (prevent replay)
  if (txTime <= lastConvertTime) {
    throw new ValidationError(
      'This transaction is older than your last conversion. Payment already used.'
    );
  }
  // NO 7-day cooldown check - payment is the rate limiter
}

// Step 5: Verify payment amount (should be ~0.1 USD in ETH)
const minPayment = 0.08; // Allow 20% tolerance for price fluctuations
const maxPayment = 0.12;
if (txData.amountInUSD < minPayment || txData.amountInUSD > maxPayment) {
  throw new ValidationError(
    `Payment amount must be approximately 0.1 USD (received ${txData.amountInUSD} USD)`
  );
}

// Step 6: Verify user has sufficient XP
const currentXP = user.game_score || 0;
if (currentXP < xpAmount) {
  throw new ValidationError(
    `Insufficient XP. You have ${currentXP} XP but need ${xpAmount} XP.`
  );
}

// Step 7: Calculate points to add
const pointsAdded = xpAmount / CONVERSION_RATE;

// Step 8: Convert XP and update last_convert with transaction timestamp
const txTimestamp = new Date(txData.timestamp * 1000).toISOString();
await supabaseService
  .from('shellies_raffle_users')
  .update({
    game_score: currentXP - xpAmount,
    points: (user.points || 0) + pointsAdded,
    last_convert: txTimestamp, // Use transaction timestamp as source of truth
    updated_at: now
  })
  .eq('wallet_address', walletAddress);
```

#### 4.2 Create Transaction Verification Service

**New File**: `src/lib/services/transaction-verification.ts`

```typescript
import { createPublicClient, http } from 'viem';
import { inkSepolia } from '@/lib/wagmi'; // or mainnet

interface TransactionData {
  isValid: boolean;
  timestamp: number;
  amount: bigint;
  amountInUSD: number;
  from: string;
  to: string;
}

export async function verifyConversionPayment(
  txHash: string,
  expectedWallet: string
): Promise<TransactionData> {
  const client = createPublicClient({
    chain: inkSepolia,
    transport: http()
  });
  
  // Fetch transaction receipt
  const receipt = await client.getTransactionReceipt({ hash: txHash });
  
  if (!receipt) {
    return { isValid: false, timestamp: 0, amount: 0n, amountInUSD: 0, from: '', to: '' };
  }
  
  // Fetch transaction details
  const tx = await client.getTransaction({ hash: txHash });
  
  // CRITICAL SECURITY CHECKS:
  // 1. Transaction was successful
  // 2. Transaction sender matches authenticated user (prevents using other user's payments)
  // 3. Transaction recipient is the payment contract
  const isValid = 
    receipt.status === 'success' &&
    tx.from.toLowerCase() === expectedWallet.toLowerCase() && // CRITICAL: Wallet verification
    tx.to?.toLowerCase() === process.env.NEXT_PUBLIC_GAME_PAYMENT_CONTRACT?.toLowerCase();
  
  // Get block timestamp
  const block = await client.getBlock({ blockNumber: receipt.blockNumber });
  
  // Get current ETH price in USD (use price oracle)
  const ethPriceInUSD = await getETHPriceInUSD();
  const amountInETH = Number(tx.value) / 1e18;
  const amountInUSD = amountInETH * ethPriceInUSD;
  
  return {
    isValid,
    timestamp: Number(block.timestamp),
    amount: tx.value,
    amountInUSD,
    from: tx.from,
    to: tx.to || ''
  };
}

async function getETHPriceInUSD(): Promise<number> {
  // Use existing price oracle or implement new one
  // For now, return a placeholder
  return 3000; // TODO: Implement real price fetching
}
```

---

### Phase 5: Security Measures

#### 5.1 Transaction Replay Prevention
- **Source of Truth**: Transaction timestamp vs `last_convert` timestamp
- **Logic**: Only allow conversion if `tx.timestamp > last_convert`
- **Benefit**: Prevents using the same transaction multiple times

#### 5.2 Concurrency Protection
- Use database-level atomic operations
- Add unique constraint on transaction hash (optional)
- Implement optimistic locking if needed

#### 5.3 Payment Verification
- Verify transaction exists on blockchain
- Verify transaction is successful (`status === 'success'`)
- Verify transaction is to correct contract address
- Verify transaction is from user's wallet
- Verify payment amount is approximately 0.1 USD (with tolerance)

#### 5.4 Rate Limiting
- **Remove 7-day cooldown** - Payment is the rate limiter
- Users can convert as many times as they want (if they pay each time)
- Add API rate limiting to prevent spam/DOS attacks (e.g., max 10 requests per minute per IP)
- Payment requirement naturally prevents abuse

---

### Phase 6: Error Handling & Edge Cases

#### 6.1 Transaction Failures
- User pays but transaction fails → Show error, allow retry
- Transaction pending → Show loading state, poll for confirmation
- Transaction confirmed but API call fails → Store txHash in localStorage, allow retry with same hash

#### 6.2 Price Fluctuations
- Allow 20% tolerance for ETH price changes
- Display estimated cost in USD before payment
- Fetch real-time ETH price from oracle

#### 6.3 Network Issues
- Implement retry logic with exponential backoff
- Store txHash locally for recovery
- Add "Resume Conversion" button if interrupted

---

### Phase 7: Testing Strategy

#### 7.1 Smart Contract Testing
- Test `payToConvertXP()` function
- Test event emission
- Test with various payment amounts

#### 7.2 API Testing
- Test transaction verification logic
- Test timestamp comparison
- Test payment amount validation
- Test replay attack prevention
- Test concurrent conversion attempts

#### 7.3 Frontend Testing
- Test payment flow
- Test error handling
- Test localStorage recovery
- Test loading states

#### 7.4 Integration Testing
- End-to-end conversion flow
- Test with real blockchain transactions (testnet)
- Test edge cases (network failures, etc.)

---

## Implementation Order

### Step 1: Smart Contract (1-2 hours)
1. Add `payToConvertXP()` function
2. Update ABI file
3. Deploy to testnet
4. Test contract function

### Step 2: Backend Infrastructure (4-5 hours)
1. Create transaction verification service
2. Update convert-xp API endpoint
3. **Remove 7-day cooldown logic**
4. Add session authentication (get wallet from session)
5. Add payment verification logic (verify tx.from === session.address)
6. Add timestamp comparison logic (for replay prevention only)
7. Create status check endpoint for recovery mechanism
8. Test API with mock transactions

### Step 3: Frontend Integration (5-6 hours)
1. Create game payment service utility
2. Update XPBridge component
3. **Remove 7-day cooldown UI and logic**
4. Add payment flow UI
5. Add loading states
6. Add error handling
7. Add localStorage backup with metadata
8. **Add recovery mechanism**:
   - Check localStorage on mount
   - Compare with `last_convert` timestamp
   - Show "Resume Conversion" button if needed
   - Implement resume function
   - Auto-clear old/processed conversions

### Step 4: Testing & Refinement (2-3 hours)
1. Test on testnet
2. Fix bugs
3. Add polish and UX improvements
4. Test edge cases

### Step 5: Documentation & Deployment (1 hour)
1. Update documentation
2. Deploy contract to mainnet
3. Update environment variables
4. Deploy frontend/backend

**Total Estimated Time**: 13-17 hours

---

## Files to Create/Modify

### New Files
1. `src/lib/services/transaction-verification.ts` - Transaction verification logic
2. `src/lib/game-payment-service.ts` - Contract interaction utilities
3. `src/app/api/bridge/convert-xp/status/route.ts` - Status check endpoint for recovery
4. `XP_CONVERSION_PAYMENT_IMPLEMENTATION_PLAN.md` - This file
5. `PAYMENT_RECOVERY_MECHANISM.md` - Recovery mechanism documentation

### Modified Files
1. `contracts/GamePaymentContract.sol` - Add `payToConvertXP()` function
2. `src/lib/game-payment-abi.ts` - Update ABI
3. `src/components/XPBridge.tsx` - Add payment flow, **remove 7-day cooldown logic**, **add recovery mechanism**
4. `src/app/api/bridge/convert-xp/route.ts` - Add transaction verification, **remove 7-day cooldown check**, **add session auth**
5. `.env.example` - Document any new env variables

---

## Security Considerations

### ✅ Implemented Protections
1. **Replay Attack Prevention**: Transaction timestamp must be newer than last_convert
2. **Payment Verification**: Verify transaction on blockchain
3. **Amount Validation**: Verify payment is approximately 0.1 USD
4. **Wallet Verification**: Verify transaction is from user's wallet
5. **Contract Verification**: Verify transaction is to correct contract
6. **Atomic Operations**: Use database transactions for consistency

### ⚠️ Additional Recommendations
1. Add transaction hash logging for audit trail
2. Implement monitoring for suspicious patterns
3. Add admin dashboard to review conversions
4. Consider adding maximum XP conversion limit per transaction
5. Add circuit breaker if too many failed verifications

---

## User Flow Diagram

```
User clicks "Convert XP"
    ↓
Calculate ETH amount (0.1 USD / ETH price)
    ↓
Show payment confirmation modal
    ↓
User approves transaction in wallet
    ↓
Wait for transaction confirmation
    ↓
Store txHash in localStorage
    ↓
Call /api/bridge/convert-xp with txHash
    ↓
Server verifies transaction on blockchain
    ↓
Server checks tx.timestamp > last_convert
    ↓
Server verifies payment amount
    ↓
Server converts XP to points
    ↓
Server updates last_convert = tx.timestamp
    ↓
Return success to client
    ↓
Update UI with new balances
    ↓
Clear localStorage
```

---

## Rollback Plan

If issues arise:
1. Disable conversion feature in UI (feature flag)
2. Keep existing API endpoint for status checks
3. Investigate issues without affecting users
4. Fix and redeploy
5. Re-enable feature

---

## Success Metrics

1. **Security**: Zero successful replay attacks
2. **Reliability**: >99% successful conversions after payment
3. **Performance**: <5 seconds total conversion time
4. **User Experience**: Clear error messages, smooth flow
5. **Revenue**: Track total conversion payments collected

---

## Next Steps

1. Review this plan with team
2. Get approval for smart contract changes
3. Set up testnet environment
4. Begin implementation in order listed above
5. Test thoroughly before mainnet deployment
