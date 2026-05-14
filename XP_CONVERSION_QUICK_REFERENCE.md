# XP Conversion Payment - Quick Reference

## 🎯 Core Concept

**Payment Required**: User pays 0.1 USD to convert 1000 XP → 100 points

**Security Model**: Transaction timestamp > last_convert timestamp = Allow

---

## 📋 Key Changes Summary

### 1. Smart Contract
**File**: `contracts/GamePaymentContract.sol`

```solidity
// ADD THIS FUNCTION
function payToConvertXP() external payable {
    require(msg.value > 0, "Payment amount must be greater than 0");
    totalCollected += msg.value;
    emit XPConversionPayment(msg.sender, msg.value, block.timestamp);
}

// ADD THIS EVENT
event XPConversionPayment(
    address indexed player, 
    uint256 amount, 
    uint256 timestamp
);
```

### 2. Frontend Component
**File**: `src/components/XPBridge.tsx`

```typescript
// REMOVE these cooldown-related items:
// - canConvert state
// - secondsUntilNextConvert state
// - Countdown timer useEffect
// - formatCountdown function
// - Cooldown display UI
// - GET request to check conversion status

// REPLACE "Coming Soon" button with:
const handleConvert = async () => {
  // 1. Calculate ETH amount
  const ethAmount = 0.1 / ethPriceInUSD;
  
  // 2. Call smart contract
  const txHash = await payForXPConversion(0.1, ethPriceInUSD);
  
  // 3. Store txHash
  localStorage.setItem('pendingConversionTx', txHash);
  
  // 4. Call API
  const response = await fetch('/api/bridge/convert-xp', {
    method: 'POST',
    body: JSON.stringify({
      walletAddress: address,
      xpAmount: currentXP,
      txHash: txHash
    })
  });
  
  // 5. Handle response
  if (response.ok) {
    localStorage.removeItem('pendingConversionTx');
    onConversionComplete(data.newXP, data.newPoints);
  }
};
```

### 3. Backend API
**File**: `src/app/api/bridge/convert-xp/route.ts`

```typescript
// ADD to POST handler:
const { walletAddress, xpAmount, txHash } = body;

// 1. Verify transaction
const txData = await verifyConversionPayment(txHash, walletAddress);

// 2. Check timestamp (CRITICAL - for replay prevention only)
// NOTE: 7-day cooldown is REMOVED - users can convert anytime if they pay
if (user.last_convert) {
  const lastConvertTime = new Date(user.last_convert).getTime();
  const txTime = txData.timestamp * 1000;
  
  if (txTime <= lastConvertTime) {
    throw new ValidationError('Payment already used');
  }
  // NO cooldown check - payment is the rate limiter
}

// 3. Verify amount
if (txData.amountInUSD < 0.08 || txData.amountInUSD > 0.12) {
  throw new ValidationError('Invalid payment amount');
}

// 4. Convert and update with tx timestamp
const txTimestamp = new Date(txData.timestamp * 1000).toISOString();
await supabaseService
  .from('shellies_raffle_users')
  .update({
    game_score: currentXP - xpAmount,
    points: (user.points || 0) + pointsAdded,
    last_convert: txTimestamp, // Use blockchain timestamp (for replay prevention)
    updated_at: now
  })
  .eq('wallet_address', walletAddress);
```

### 4. Transaction Verification Service
**File**: `src/lib/services/transaction-verification.ts` (NEW)

```typescript
export async function verifyConversionPayment(
  txHash: string,
  expectedWallet: string
): Promise<TransactionData> {
  // 1. Fetch transaction from blockchain
  const receipt = await client.getTransactionReceipt({ hash: txHash });
  const tx = await client.getTransaction({ hash: txHash });
  const block = await client.getBlock({ blockNumber: receipt.blockNumber });
  
  // 2. Verify all conditions
  const isValid = 
    receipt.status === 'success' &&
    tx.from.toLowerCase() === expectedWallet.toLowerCase() &&
    tx.to?.toLowerCase() === GAME_PAYMENT_CONTRACT.toLowerCase();
  
  // 3. Calculate USD amount
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
```

---

## 🔐 Security Checks

### Transaction Verification Checklist
```typescript
✓ Transaction exists on blockchain
✓ Transaction status = 'success'
✓ Transaction.from = user's wallet
✓ Transaction.to = GAME_PAYMENT_CONTRACT
✓ Transaction.value ≈ 0.1 USD (±20%)
✓ Transaction.timestamp > last_convert (CRITICAL)
```

### Why Timestamp Comparison Works
```
Blockchain timestamp = Immutable, cryptographically secured
Database last_convert = Last successful conversion time

If tx.timestamp > last_convert:
  → This is a NEW payment → ALLOW
Else:
  → This payment was already used → REJECT
```

---

## 🚀 Implementation Steps

### Phase 1: Smart Contract (2 hours)
1. Add `payToConvertXP()` function to contract
2. Update `src/lib/game-payment-abi.ts`
3. Deploy to testnet
4. Test payment function

### Phase 2: Backend (4 hours)
1. Create `src/lib/services/transaction-verification.ts`
2. Update `src/app/api/bridge/convert-xp/route.ts`
3. **Remove 7-day cooldown check**
4. Add timestamp comparison logic (replay prevention only)
5. Add payment verification
6. Test with mock transactions

### Phase 3: Frontend (4 hours)
1. Create `src/lib/game-payment-service.ts`
2. Update `src/components/XPBridge.tsx`
3. **Remove 7-day cooldown UI and logic**
4. Add payment flow
5. Add loading states
6. Add error handling

### Phase 4: Testing (2 hours)
1. Test on testnet
2. Test replay attack prevention
3. Test concurrent requests
4. Fix bugs

### Phase 5: Deploy (1 hour)
1. Deploy contract to mainnet
2. Update env variables
3. Deploy frontend/backend
4. Monitor

**Total**: ~13 hours

---

## 📁 Files to Create/Modify

### New Files
- `src/lib/services/transaction-verification.ts`
- `src/lib/game-payment-service.ts`

### Modified Files
- `contracts/GamePaymentContract.sol` - Add `payToConvertXP()`
- `src/lib/game-payment-abi.ts` - Update ABI
- `src/components/XPBridge.tsx` - Add payment flow, **remove cooldown**
- `src/app/api/bridge/convert-xp/route.ts` - Add verification, **remove cooldown**

---

## 🧪 Testing Scenarios

### Test 1: Normal Conversion
```
1. User has 5000 XP, 200 points
2. User pays 0.1 USD → txHash: 0xabc
3. Server verifies tx
4. Server checks: tx.timestamp > last_convert ✓
5. Convert: 1000 XP → 100 points
6. Update: last_convert = tx.timestamp
7. Result: 4000 XP, 300 points ✓
```

### Test 2: Replay Attack
```
1. User tries to reuse old txHash: 0xabc
2. Server checks: tx.timestamp ≤ last_convert ✗
3. Result: REJECTED ✓
```

### Test 3: Concurrent Requests
```
1. User sends two requests simultaneously
2. Both have valid, new transactions
3. First request succeeds, updates last_convert
4. Second request fails timestamp check
5. Result: Only one conversion ✓
```

### Test 4: Invalid Payment
```
1. User pays 0.05 USD (too low)
2. Server checks: amount < 0.08 USD ✗
3. Result: REJECTED ✓
```

---

## 🔧 Environment Variables

Add to `.env`:
```bash
# Already exists
NEXT_PUBLIC_GAME_PAYMENT_CONTRACT=0xYourContractAddress

# May need to add
NEXT_PUBLIC_ETH_PRICE_ORACLE_URL=https://api.coingecko.com/api/v3/simple/price
```

---

## 📊 Database Schema

**No changes needed!** Existing `last_convert` column is reused:

```sql
-- Existing column in shellies_raffle_users
last_convert TIMESTAMPTZ

-- Usage changes:
-- BEFORE: Stores time of last conversion + enforces 7-day cooldown
-- AFTER:  Stores blockchain timestamp of last payment (replay prevention only)
-- NOTE:   7-day cooldown is REMOVED - users can convert anytime if they pay
```

---

## 🎨 UI Flow

```
┌─────────────────────────────────────┐
│  XP Converter                       │
│  ─────────────────────────────────  │
│  Available: 5,000 XP                │
│  Rate: 1000 XP = 100 points         │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ Convert All XP                │ │
│  │ Pay 0.1 USD (~0.00003 ETH)    │ │
│  └───────────────────────────────┘ │
│                                     │
│  You will receive: 500 points       │
└─────────────────────────────────────┘

User clicks button
    ↓
┌─────────────────────────────────────┐
│  Confirm Payment                    │
│  ─────────────────────────────────  │
│  Amount: 0.1 USD                    │
│  Network Fee: ~0.0001 ETH           │
│  Total: ~0.00004 ETH                │
│                                     │
│  [Cancel]  [Confirm in Wallet]      │
└─────────────────────────────────────┘

User confirms in wallet
    ↓
┌─────────────────────────────────────┐
│  Processing...                      │
│  ─────────────────────────────────  │
│  ⏳ Waiting for transaction...      │
│  ⏳ Verifying payment...             │
│  ⏳ Converting XP...                 │
└─────────────────────────────────────┘

Success
    ↓
┌─────────────────────────────────────┐
│  ✓ Conversion Successful!           │
│  ─────────────────────────────────  │
│  Converted: 5000 XP → 500 points    │
│  New Balance: 0 XP, 700 points      │
└─────────────────────────────────────┘
```

---

## ⚠️ Important Notes

1. **Timestamp is Critical**: The blockchain timestamp comparison is the core security mechanism
2. **No Schema Changes**: Reuse existing `last_convert` column
3. **Atomic Operations**: Use database transactions for consistency
4. **Price Tolerance**: Allow ±20% for ETH price fluctuations
5. **localStorage Backup**: Store txHash for recovery if API call fails
6. **Error Handling**: Clear error messages for all failure cases

---

## 🐛 Common Issues & Solutions

### Issue: Transaction confirmed but API fails
**Solution**: Store txHash in localStorage, add "Resume Conversion" button

### Issue: ETH price changes during payment
**Solution**: 20% tolerance in payment verification

### Issue: User tries to convert with old transaction
**Solution**: Timestamp check rejects it automatically

### Issue: Concurrent conversion attempts
**Solution**: Atomic database operations ensure only one succeeds

---

## 📞 Support Checklist

When user reports issue:
1. Check transaction hash on blockchain explorer
2. Verify transaction timestamp
3. Check user's `last_convert` value
4. Compare timestamps
5. Check payment amount in USD
6. Review audit logs

---

## ✅ Definition of Done

- [ ] Smart contract deployed with `payToConvertXP()`
- [ ] Transaction verification service implemented
- [ ] API endpoint updated with timestamp check
- [ ] Frontend payment flow working
- [ ] All security checks passing
- [ ] Replay attacks prevented
- [ ] Concurrent requests handled
- [ ] Error handling complete
- [ ] Tested on testnet
- [ ] Deployed to mainnet
- [ ] Monitoring in place
- [ ] Documentation updated

---

## 🎉 Success Criteria

- ✅ Users can pay 0.1 USD to convert XP
- ✅ Zero successful replay attacks
- ✅ >99% conversion success rate after payment
- ✅ <5 seconds total conversion time
- ✅ Clear error messages
- ✅ Smooth user experience
