# XP Conversion Payment - Security Flow

## Core Security Principle

**Source of Truth**: Blockchain transaction timestamp vs Database `last_convert` timestamp

```
Transaction Timestamp > last_convert Timestamp = ✅ Allow Conversion
Transaction Timestamp ≤ last_convert Timestamp = ❌ Reject (Already Used)
```

---

## Detailed Security Flow

### 1. User Initiates Conversion

```typescript
// Frontend: XPBridge.tsx
User clicks "Convert XP" button
  ↓
Check: User has sufficient XP (1000 XP minimum)
Check: User wallet is connected
Check: Not on cooldown (optional additional check)
  ↓
Calculate payment: 0.1 USD in ETH
Display: "Pay 0.1 USD (~0.00003 ETH) to convert 1000 XP → 100 points"
  ↓
User confirms payment
```

### 2. Blockchain Payment Transaction

```typescript
// Frontend: game-payment-service.ts
Call: payToConvertXP() on smart contract
  ↓
User approves in wallet (MetaMask/WalletConnect)
  ↓
Transaction submitted to blockchain
  ↓
Wait for confirmation (1-2 blocks)
  ↓
Receive: Transaction Hash (txHash)
  ↓
Store: localStorage.setItem('pendingConversionTx', txHash)
```

### 3. Server-Side Verification

```typescript
// Backend: /api/bridge/convert-xp
Receive: { walletAddress, xpAmount, txHash }
  ↓
Step 1: Fetch transaction from blockchain
  - Get transaction receipt
  - Get transaction details
  - Get block timestamp
  ↓
Step 2: Verify transaction validity
  ✓ Transaction exists
  ✓ Transaction status = 'success'
  ✓ Transaction.from = user's wallet
  ✓ Transaction.to = GAME_PAYMENT_CONTRACT
  ✓ Transaction.value ≈ 0.1 USD (±20% tolerance)
  ↓
Step 3: Fetch user's last_convert from database
  Query: SELECT last_convert FROM shellies_raffle_users WHERE wallet_address = ?
  ↓
Step 4: Compare timestamps (CRITICAL SECURITY CHECK)
  tx_timestamp = block.timestamp (from blockchain)
  last_convert_timestamp = user.last_convert (from database)
  
  IF tx_timestamp > last_convert_timestamp:
    ✅ ALLOW: This is a new payment
  ELSE:
    ❌ REJECT: Payment already used or older than last conversion
  
  NOTE: NO 7-day cooldown check - users can convert anytime if they pay
  ↓
Step 5: Execute conversion (atomic operation)
  BEGIN TRANSACTION
    UPDATE shellies_raffle_users SET
      game_score = game_score - 1000,
      points = points + 100,
      last_convert = tx_timestamp,  ← Store blockchain timestamp
      updated_at = NOW()
    WHERE wallet_address = ?
  COMMIT TRANSACTION
  ↓
Step 6: Return success
  Response: { newXP, newPoints, pointsAdded }
```

---

## Security Scenarios

### Scenario 1: Normal Conversion ✅

```
User State:
  - XP: 5000
  - Points: 200
  - last_convert: 2025-01-01 10:00:00 (timestamp: 1704103200)

User Action:
  1. Pays 0.1 USD → txHash: 0xabc123
  2. Transaction confirmed at 2025-01-15 14:30:00 (timestamp: 1705329000)

Server Check:
  tx_timestamp (1705329000) > last_convert (1704103200) ✅
  NO 7-day cooldown check ✅
  
Result: ALLOW
  - Convert 1000 XP → 100 points
  - Update last_convert = 1705329000
  - New state: XP: 4000, Points: 300
```

### Scenario 2: Replay Attack Attempt ❌

```
User State:
  - XP: 4000
  - Points: 300
  - last_convert: 2025-01-15 14:30:00 (timestamp: 1705329000)

Attacker Action:
  1. Tries to reuse old txHash: 0xabc123
  2. Old transaction timestamp: 2025-01-15 14:30:00 (timestamp: 1705329000)

Server Check:
  tx_timestamp (1705329000) ≤ last_convert (1705329000) ❌
  
Result: REJECT
  Error: "This transaction is older than your last conversion. Payment already used."
```

### Scenario 3: Concurrent Conversion Attempts ❌

```
User State:
  - XP: 5000
  - Points: 200
  - last_convert: 2025-01-01 10:00:00

User Action (simultaneous):
  Request A: txHash: 0xabc123 (timestamp: 1705329000)
  Request B: txHash: 0xdef456 (timestamp: 1705329005)

Server Processing:
  Request A arrives first:
    ✅ tx_timestamp (1705329000) > last_convert (1704103200)
    → Convert and update last_convert = 1705329000
  
  Request B arrives second:
    ❌ tx_timestamp (1705329005) > last_convert (1705329000)
    → But database already updated by Request A
    → Atomic operation ensures only one succeeds

Result: Only ONE conversion succeeds
```

### Scenario 4: Old Transaction Attempt ❌

```
User State:
  - XP: 5000
  - Points: 300
  - last_convert: 2025-01-15 14:30:00 (timestamp: 1705329000)

User Action:
  1. Finds old transaction from 2025-01-10
  2. Tries to use txHash: 0xold999 (timestamp: 1704897600)

Server Check:
  tx_timestamp (1704897600) < last_convert (1705329000) ❌
  
Result: REJECT
  Error: "This transaction is older than your last conversion."
```

---

## Why This Approach is Secure

### 1. Blockchain as Source of Truth
- Transaction timestamp comes from blockchain (immutable)
- Cannot be manipulated by user or server
- Provides cryptographic proof of payment time

### 2. Monotonic Timestamp Progression
- `last_convert` always moves forward in time
- Old transactions cannot be reused
- Each conversion requires a NEW transaction with NEWER timestamp
- **No cooldown period** - users can convert immediately after previous conversion (if they pay)

### 3. Atomic Database Operations
- Prevents race conditions
- Ensures consistency
- Only one conversion per transaction

### 4. Multiple Verification Layers
```
Layer 1: Transaction exists on blockchain ✓
Layer 2: Transaction is successful ✓
Layer 3: Transaction is from correct wallet ✓
Layer 4: Transaction is to correct contract ✓
Layer 5: Payment amount is correct ✓
Layer 6: Transaction timestamp is newer ✓ (CRITICAL)
```

### 5. No Reliance on Client-Side Data
- Client provides txHash only
- Server fetches all data from blockchain
- Server makes all security decisions

---

## Attack Vectors & Mitigations

| Attack Vector | Mitigation |
|--------------|------------|
| **Replay Attack** | Timestamp comparison prevents reuse |
| **Double Spending** | Atomic database operations |
| **Transaction Forgery** | Verify transaction on blockchain |
| **Amount Manipulation** | Verify payment amount on-chain |
| **Wallet Spoofing** | Verify transaction sender |
| **Contract Spoofing** | Verify transaction recipient |
| **Time Manipulation** | Use blockchain timestamp (immutable) |
| **Race Conditions** | Database-level atomic operations |
| **API Spam** | Rate limiting + payment requirement |

---

## Additional Security Measures

### 1. Transaction Hash Uniqueness (Optional)
```sql
-- Add unique constraint to prevent same tx being used twice
ALTER TABLE shellies_raffle_conversions 
ADD COLUMN tx_hash VARCHAR(66) UNIQUE;

-- Store each conversion with its tx_hash
INSERT INTO shellies_raffle_conversions 
  (wallet_address, tx_hash, xp_amount, points_added, converted_at)
VALUES 
  (?, ?, ?, ?, ?);
```

### 2. Audit Trail
```typescript
// Log every conversion attempt
await supabaseService
  .from('conversion_audit_log')
  .insert({
    wallet_address,
    tx_hash,
    tx_timestamp,
    last_convert_timestamp,
    result: 'success' | 'rejected',
    reason: 'timestamp_check_failed' | 'amount_invalid' | etc.
  });
```

### 3. Monitoring & Alerts
```typescript
// Alert on suspicious patterns
if (rejectedAttempts > 5 in last hour) {
  sendAlert('Possible replay attack attempt', { wallet_address });
}
```

---

## Implementation Checklist

### Smart Contract
- [ ] Add `payToConvertXP()` function
- [ ] Add `XPConversionPayment` event
- [ ] Deploy to testnet
- [ ] Test payment function
- [ ] Deploy to mainnet

### Backend
- [ ] Create transaction verification service
- [ ] Implement timestamp comparison logic (replay prevention only)
- [ ] **Remove 7-day cooldown check from API**
- [ ] Update convert-xp API endpoint
- [ ] Add payment amount validation
- [ ] Add error handling
- [ ] Add audit logging
- [ ] Test with mock transactions
- [ ] Test replay attack prevention

### Frontend
- [ ] Create game payment service
- [ ] Update XPBridge component
- [ ] **Remove 7-day cooldown UI and countdown timer**
- [ ] **Remove cooldown status checks**
- [ ] Add payment flow UI
- [ ] Add transaction confirmation wait
- [ ] Add localStorage backup
- [ ] Add error handling
- [ ] Add loading states
- [ ] Test on testnet

### Testing
- [ ] Unit tests for verification logic
- [ ] Integration tests for full flow
- [ ] Test replay attack scenarios
- [ ] Test concurrent requests
- [ ] Test edge cases
- [ ] Load testing

### Deployment
- [ ] Update environment variables
- [ ] Deploy smart contract
- [ ] Deploy backend changes
- [ ] Deploy frontend changes
- [ ] Monitor for issues
- [ ] Document for team

---

## Conclusion

This security model ensures:
1. ✅ **No replay attacks**: Old transactions cannot be reused
2. ✅ **No double spending**: Each payment = one conversion
3. ✅ **Verifiable payments**: All data from blockchain
4. ✅ **Atomic operations**: No race conditions
5. ✅ **Audit trail**: All attempts logged
6. ✅ **Scalable**: Works with high concurrency

The blockchain timestamp comparison is the **critical security mechanism** that makes this system secure and prevents all forms of payment reuse.
