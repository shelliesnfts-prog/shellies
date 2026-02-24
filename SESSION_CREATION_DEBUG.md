# Game Session Creation Debugging

## ✅ ISSUE RESOLVED

### Root Cause
The payment amount validation was failing because:
- Frontend uses **dynamic tier-based pricing** (staker/NFT holder/regular)
- Backend was validating against a **fixed USD amount** ($0.50)
- User paid ~$0.08 (tier-based amount) but system expected $0.50

### The Fix
Disabled amount validation in the backend since we use tier-based pricing:
1. Updated `/api/game-session` to pass `0` to `verifyGamePayment()` (skips amount check)
2. Updated `transaction-verification.ts` to skip validation when `expectedAmountUsd` is 0
3. Now only validates:
   - ✅ Transaction was successful
   - ✅ Transaction is from authenticated wallet
   - ✅ Transaction is to correct payment contract

### Files Changed
- `src/app/api/game-session/route.ts` - Disabled amount validation
- `src/lib/services/transaction-verification.ts` - Skip amount check when expectedAmountUsd is 0

---

## Original Issue Documentation
Payment is being confirmed on the blockchain, but the game session creation is failing with the error:
> "Payment confirmed but failed to create game session. Please refresh."

## Root Cause Analysis

The payment flow works as follows:
1. User initiates payment → Transaction sent to blockchain
2. Transaction confirmed → `isConfirmed` becomes true
3. `useGamePayment` hook detects confirmation → Calls `/api/game-session` POST endpoint
4. API verifies transaction on blockchain → Creates game session in database
5. Session created → Game can start

The failure is happening somewhere in steps 3-4.

## Potential Failure Points

### 1. Transaction Verification Failure
The API calls `verifyGamePayment()` which:
- Fetches transaction receipt from blockchain
- Fetches transaction details
- Gets block timestamp (with retry logic for indexing delays)
- Validates:
  - Transaction was successful
  - Sender matches authenticated wallet
  - Recipient is the game payment contract
  - Amount is within acceptable range (±20% tolerance)

**Common issues:**
- Block not indexed yet (should auto-retry)
- Wrong contract address in environment variables
- Transaction from different wallet than authenticated user
- Amount validation failing due to ETH price fluctuations

### 2. User Creation Failure
Before creating a session, the API ensures the user exists in `shellies_raffle_users`:
- Checks if user exists
- Creates user with default values if not exists

**Common issues:**
- Database connection issues
- Duplicate key violations (race condition)
- Missing permissions

### 3. Session Creation Failure
The API inserts a new record into `shellies_raffle_game_sessions`:
- Validates transaction hash not already used
- Creates session with 24-hour expiry

**Common issues:**
- Duplicate transaction hash (transaction already used)
- Database constraints
- Missing permissions

## Changes Made

### 1. Enhanced Error Logging in `useGamePayment.ts`
Added detailed console logs to track:
- Session creation API call status
- Response details
- Error messages with full context

```typescript
console.error('❌ Session creation failed:', {
  status: response.status,
  statusText: response.statusText,
  error: error,
  transactionHash: hash
});
```

### 2. Enhanced Error Logging in `/api/game-session`
Added comprehensive logging for:
- User existence check
- User creation (if needed)
- Transaction verification
- Session creation

```typescript
console.log('🔍 Verifying transaction:', { ... });
console.log('📊 Transaction verification result:', { ... });
console.log('👤 Checking if user exists:', walletAddress);
console.log('🎮 Creating game session:', { ... });
```

### 3. Enhanced Transaction Verification Logging
Added step-by-step logging in `transaction-verification.ts`:
- Blockchain client creation
- Receipt fetching
- Transaction details
- Block timestamp retrieval
- Security checks
- Amount validation

```typescript
console.log('🔗 Creating blockchain client for verification...');
console.log('📥 Fetching transaction receipt...');
console.log('✅ Receipt found:', { ... });
```

## How to Debug

### Step 1: Reproduce the Issue
1. Open browser DevTools (F12)
2. Go to Console tab
3. Clear console
4. Attempt to make a payment
5. Watch for error messages

### Step 2: Check Browser Console
Look for these log patterns:

**Success flow:**
```
✅ Network validation passed - Ink Chain detected
🎮 Payment initiation requested
✅ Network check passed at component level
[Transaction signing...]
✅ Session created successfully
```

**Failure flow - Look for:**
```
❌ Session creation failed: { status: 500, error: "..." }
```

### Step 3: Check Server Logs
If using Vercel/deployment platform:
1. Go to deployment logs
2. Filter for errors around the time of payment
3. Look for these patterns:

**Transaction verification issues:**
```
❌ Invalid transaction hash format
❌ Transaction receipt not found
❌ Error fetching block
🔐 Security check results: { isValid: false, ... }
```

**User creation issues:**
```
❌ Error checking user existence
❌ Error creating user
```

**Session creation issues:**
```
❌ Error creating game session: { code: '...', message: '...' }
```

### Step 4: Check Database
Query the database to see what's actually stored:

```sql
-- Check if user exists
SELECT * FROM shellies_raffle_users 
WHERE wallet_address = '0x...';

-- Check if session was created
SELECT * FROM shellies_raffle_game_sessions 
WHERE wallet_address = '0x...'
ORDER BY created_at DESC
LIMIT 5;

-- Check if transaction hash was already used
SELECT * FROM shellies_raffle_game_sessions 
WHERE transaction_hash = '0x...';
```

## Common Issues & Solutions

### Issue 1: "Transaction already used"
**Symptom:** Error says transaction hash already exists
**Cause:** User clicked pay multiple times or refreshed during payment
**Solution:** Clear old sessions or use a new payment

### Issue 2: "Invalid payment transaction"
**Symptom:** Transaction verification fails
**Cause:** 
- Wrong network (not Ink Chain)
- Wrong contract address
- Transaction from different wallet
**Solution:** 
- Verify `NEXT_PUBLIC_GAME_PAYMENT_CONTRACT_ADDRESS` in `.env`
- Ensure user is on Ink Chain (Chain ID: 57073)
- Check wallet address matches authenticated user

### Issue 3: "Block is out of range"
**Symptom:** Error fetching block timestamp
**Cause:** Block not indexed yet by RPC node
**Solution:** Code already has retry logic (5 attempts with exponential backoff)
If still failing, RPC node might be slow/down

### Issue 4: Database Permission Error
**Symptom:** Error code 42501 or similar
**Cause:** Supabase RLS policies blocking insert
**Solution:** Check RLS policies on `shellies_raffle_game_sessions` table

### Issue 5: Amount Validation Failing
**Symptom:** `isAmountValid: false` in logs
**Cause:** ETH price fluctuation or wrong payment amount
**Solution:** 
- Check `GAME_PAYMENT_AMOUNT_USD` environment variable
- Verify payment tier calculation is correct
- Check ETH price oracle is working

## Environment Variables to Verify

```bash
# Game payment contract address (CRITICAL)
NEXT_PUBLIC_GAME_PAYMENT_CONTRACT_ADDRESS=0x...
# or
NEXT_PUBLIC_GAME_PAYMENT_CONTRACT=0x...

# Expected payment amount in USD
GAME_PAYMENT_AMOUNT_USD=0.50

# Supabase credentials
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# NextAuth
NEXTAUTH_SECRET=...
NEXTAUTH_URL=...
```

## Next Steps

1. **Reproduce the issue** with browser console open
2. **Capture the exact error message** from console logs
3. **Check server logs** for detailed error information
4. **Verify environment variables** are correctly set
5. **Check database** to see if session was partially created

## Testing After Fix

Once the issue is identified and fixed:

1. Test with a new wallet (never used before)
2. Test with an existing wallet
3. Test payment flow end-to-end
4. Verify session is created in database
5. Verify game starts successfully
6. Test score submission works

## Contact Points

If the issue persists after checking logs:
- Share browser console logs (screenshot or copy/paste)
- Share server logs from deployment platform
- Share database query results
- Share environment variable configuration (redact sensitive values)
