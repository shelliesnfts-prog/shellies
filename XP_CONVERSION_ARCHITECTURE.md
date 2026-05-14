# XP Conversion Payment - System Architecture

## 🏗️ System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                          │
│                    (XPBridge Component)                         │
│  - Display XP/Points balance                                    │
│  - Calculate conversion preview                                 │
│  - Trigger payment transaction                                  │
│  - Show loading/success/error states                            │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BLOCKCHAIN LAYER                             │
│              (GamePaymentContract.sol)                          │
│  - payToConvertXP() function                                    │
│  - Accept 0.1 USD payment in ETH                                │
│  - Emit XPConversionPayment event                               │
│  - Return transaction hash                                      │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API LAYER                                    │
│           (/api/bridge/convert-xp)                              │
│  - Receive txHash from client                                   │
│  - Verify transaction on blockchain                             │
│  - Check timestamp vs last_convert                              │
│  - Execute conversion                                           │
│  - Update database                                              │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                  VERIFICATION SERVICE                           │
│        (transaction-verification.ts)                            │
│  - Fetch transaction from blockchain                            │
│  - Verify transaction validity                                  │
│  - Extract timestamp from block                                 │
│  - Calculate USD amount                                         │
│  - Return verification result                                   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DATABASE LAYER                               │
│              (Supabase PostgreSQL)                              │
│  - shellies_raffle_users table                                  │
│  - Store last_convert timestamp                                 │
│  - Update XP and points atomically                              │
│  - Maintain audit trail                                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Complete Flow Diagram

```
┌──────────┐
│  USER    │
└────┬─────┘
     │
     │ 1. Click "Convert XP"
     ▼
┌─────────────────────────────────┐
│  XPBridge Component             │
│  - Check: Has sufficient XP?    │
│  - Check: Wallet connected?     │
│  - Calculate: ETH amount        │
│  - Display: Confirmation modal  │
└────┬────────────────────────────┘
     │
     │ 2. User confirms payment
     ▼
┌─────────────────────────────────┐
│  game-payment-service.ts        │
│  - Call: payToConvertXP()       │
│  - Value: 0.1 USD in ETH        │
└────┬────────────────────────────┘
     │
     │ 3. Transaction submitted
     ▼
┌─────────────────────────────────┐
│  Blockchain (Ink Network)       │
│  - Execute: payToConvertXP()    │
│  - Emit: XPConversionPayment    │
│  - Block mined with timestamp   │
└────┬────────────────────────────┘
     │
     │ 4. Transaction confirmed
     │    txHash: 0xabc123...
     ▼
┌─────────────────────────────────┐
│  XPBridge Component             │
│  - Store: localStorage          │
│  - Call: API with txHash        │
└────┬────────────────────────────┘
     │
     │ 5. POST /api/bridge/convert-xp
     │    { walletAddress, xpAmount, txHash }
     ▼
┌─────────────────────────────────┐
│  API Route Handler              │
│  - Validate: Request body       │
│  - Call: verifyConversionPayment│
└────┬────────────────────────────┘
     │
     │ 6. Verify transaction
     ▼
┌─────────────────────────────────┐
│  transaction-verification.ts    │
│  ┌───────────────────────────┐  │
│  │ Fetch from Blockchain:    │  │
│  │ - Transaction receipt     │  │
│  │ - Transaction details     │  │
│  │ - Block data              │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ Verify:                   │  │
│  │ ✓ Status = success        │  │
│  │ ✓ From = user wallet      │  │
│  │ ✓ To = payment contract   │  │
│  │ ✓ Amount ≈ 0.1 USD        │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ Extract:                  │  │
│  │ - Block timestamp         │  │
│  │ - Payment amount in USD   │  │
│  └───────────────────────────┘  │
└────┬────────────────────────────┘
     │
     │ 7. Return verification result
     │    { isValid: true, timestamp: 1705329000, ... }
     ▼
┌─────────────────────────────────┐
│  API Route Handler              │
│  ┌───────────────────────────┐  │
│  │ Fetch user data:          │  │
│  │ SELECT last_convert       │  │
│  │ FROM shellies_raffle_users│  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ CRITICAL CHECK:           │  │
│  │ IF tx.timestamp >         │  │
│  │    last_convert           │  │
│  │ THEN: Allow conversion    │  │
│  │ ELSE: Reject (used)       │  │
│  │                           │  │
│  │ NOTE: NO 7-day cooldown   │  │
│  │ Users can convert anytime │  │
│  │ if they pay               │  │
│  └───────────────────────────┘  │
└────┬────────────────────────────┘
     │
     │ 8. Timestamp check passed ✓
     ▼
┌─────────────────────────────────┐
│  Database (Atomic Operation)    │
│  BEGIN TRANSACTION              │
│  ┌───────────────────────────┐  │
│  │ UPDATE:                   │  │
│  │ game_score -= 1000        │  │
│  │ points += 100             │  │
│  │ last_convert = tx.timestamp│ │
│  │ updated_at = NOW()        │  │
│  └───────────────────────────┘  │
│  COMMIT                         │
└────┬────────────────────────────┘
     │
     │ 9. Return success
     │    { newXP, newPoints, pointsAdded }
     ▼
┌─────────────────────────────────┐
│  XPBridge Component             │
│  - Clear: localStorage          │
│  - Update: UI with new balances │
│  - Show: Success message        │
│  - Trigger: onConversionComplete│
└────┬────────────────────────────┘
     │
     │ 10. UI updated
     ▼
┌──────────┐
│  USER    │
│  ✓ Done  │
└──────────┘
```

---

## 🔐 Security Layer Breakdown

### Layer 1: Frontend Validation
```
┌─────────────────────────────────┐
│  Client-Side Checks             │
│  - Wallet connected?            │
│  - Sufficient XP?               │
│  - Not on cooldown?             │
│  - Valid input?                 │
└─────────────────────────────────┘
        │ ✓ All checks pass
        ▼
   Submit to blockchain
```

### Layer 2: Blockchain Validation
```
┌─────────────────────────────────┐
│  Smart Contract Checks          │
│  - msg.value > 0?               │
│  - Transaction successful?      │
│  - Event emitted?               │
└─────────────────────────────────┘
        │ ✓ Transaction confirmed
        ▼
   Return txHash to client
```

### Layer 3: Server-Side Verification
```
┌─────────────────────────────────┐
│  Transaction Verification       │
│  ✓ Transaction exists           │
│  ✓ Status = success             │
│  ✓ From = user wallet           │
│  ✓ To = payment contract        │
│  ✓ Amount ≈ 0.1 USD             │
└─────────────────────────────────┘
        │ ✓ All checks pass
        ▼
   Proceed to timestamp check
```

### Layer 4: Timestamp Security (CRITICAL)
```
┌─────────────────────────────────┐
│  Replay Attack Prevention       │
│                                 │
│  tx_timestamp = 1705329000      │
│  last_convert = 1704103200      │
│                                 │
│  IF tx_timestamp > last_convert │
│  THEN: ✓ Allow (new payment)    │
│  ELSE: ✗ Reject (already used)  │
└─────────────────────────────────┘
        │ ✓ Timestamp check passed
        ▼
   Execute conversion
```

### Layer 5: Database Atomicity
```
┌─────────────────────────────────┐
│  Atomic Transaction             │
│  BEGIN TRANSACTION              │
│    UPDATE user SET              │
│      game_score -= xp           │
│      points += pts              │
│      last_convert = tx.time     │
│  COMMIT                         │
│                                 │
│  Prevents race conditions       │
└─────────────────────────────────┘
        │ ✓ Committed successfully
        ▼
   Return success to client
```

---

## 📊 Data Flow

### Request Data Flow
```
Client                    API                     Blockchain
  │                        │                          │
  │  1. walletAddress      │                          │
  │  2. xpAmount           │                          │
  │  3. txHash ────────────▶                          │
  │                        │                          │
  │                        │  4. Get transaction      │
  │                        │ ─────────────────────────▶
  │                        │                          │
  │                        │  5. Transaction data     │
  │                        │ ◀─────────────────────────
  │                        │    - receipt             │
  │                        │    - tx details          │
  │                        │    - block timestamp     │
  │                        │                          │
  │                        │  6. Verify & Convert     │
  │                        │     (Database update)    │
  │                        │                          │
  │  7. Success response   │                          │
  │ ◀──────────────────────│                          │
  │    - newXP             │                          │
  │    - newPoints         │                          │
  │    - pointsAdded       │                          │
```

### Timestamp Comparison Flow
```
Blockchain                Database                 Decision
    │                        │                        │
    │  Block timestamp       │                        │
    │  1705329000 ───────────┼───────────────────────▶│
    │                        │                        │
    │                        │  last_convert          │
    │                        │  1704103200 ───────────▶│
    │                        │                        │
    │                        │                        │  Compare:
    │                        │                        │  1705329000 > 1704103200
    │                        │                        │  ✓ TRUE
    │                        │                        │
    │                        │  ◀─────────────────────│  Allow conversion
    │                        │  Update last_convert   │
    │                        │  = 1705329000          │
```

---

## 🗄️ Database Schema

### shellies_raffle_users Table
```sql
CREATE TABLE shellies_raffle_users (
  id UUID PRIMARY KEY,
  wallet_address VARCHAR(42) UNIQUE NOT NULL,
  game_score INTEGER DEFAULT 0,        -- XP balance
  points INTEGER DEFAULT 0,            -- Points balance
  last_convert TIMESTAMPTZ,            -- Last conversion tx timestamp
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for performance
CREATE INDEX idx_shellies_raffle_users_last_convert 
  ON shellies_raffle_users(last_convert);
```

### Optional: Audit Trail Table
```sql
CREATE TABLE xp_conversion_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address VARCHAR(42) NOT NULL,
  tx_hash VARCHAR(66) UNIQUE NOT NULL,
  tx_timestamp TIMESTAMPTZ NOT NULL,
  last_convert_at_time TIMESTAMPTZ,
  xp_amount INTEGER NOT NULL,
  points_added INTEGER NOT NULL,
  payment_amount_eth DECIMAL(20, 18),
  payment_amount_usd DECIMAL(10, 2),
  result VARCHAR(20) NOT NULL,         -- 'success' or 'rejected'
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_xp_conversion_audit_wallet 
  ON xp_conversion_audit(wallet_address);
CREATE INDEX idx_xp_conversion_audit_tx_hash 
  ON xp_conversion_audit(tx_hash);
CREATE INDEX idx_xp_conversion_audit_created 
  ON xp_conversion_audit(created_at);
```

---

## 🎯 Key Design Decisions

### 1. Why Blockchain Timestamp?
```
✓ Immutable - Cannot be manipulated
✓ Cryptographically secured
✓ Verifiable by anyone
✓ Monotonically increasing
✓ Tied to actual payment
```

### 2. Why Not Use Transaction Hash Uniqueness?
```
Timestamp approach is BETTER because:
✓ Simpler logic
✓ No additional database columns needed
✓ Works with existing last_convert column
✓ Natural ordering (time-based)
✓ Easy to understand and audit

Transaction hash uniqueness could be ADDED as extra layer:
✓ Store tx_hash in separate audit table
✓ Add unique constraint
✓ Provides additional security
```

### 3. Why 20% Payment Tolerance?
```
ETH price volatility:
- User sees: "Pay 0.1 USD"
- ETH price at click: $3000
- ETH amount: 0.0000333 ETH
- User confirms in wallet
- 30 seconds pass...
- ETH price changes to: $3100
- Actual USD value: $0.103

With 20% tolerance:
✓ Accepts $0.08 - $0.12
✓ Handles normal price fluctuations
✓ Prevents user frustration
✗ Rejects if too far off (manipulation attempt)
```

### 4. Why Atomic Database Operations?
```
Scenario: Two concurrent requests
Request A: tx1 (timestamp: 1000)
Request B: tx2 (timestamp: 1001)

Without atomicity:
1. A reads last_convert = 900 ✓
2. B reads last_convert = 900 ✓
3. A updates last_convert = 1000 ✓
4. B updates last_convert = 1001 ✓
Result: BOTH succeed (WRONG!)

With atomicity:
1. A locks row, reads last_convert = 900 ✓
2. A updates last_convert = 1000 ✓
3. A releases lock
4. B locks row, reads last_convert = 1000
5. B checks: 1001 > 1000 ✓
6. B updates last_convert = 1001 ✓
Result: BOTH succeed (CORRECT!)

Actually, with proper timestamp check:
1. A locks row, reads last_convert = 900 ✓
2. A checks: 1000 > 900 ✓
3. A updates last_convert = 1000 ✓
4. A releases lock
5. B locks row, reads last_convert = 1000
6. B checks: 1001 > 1000 ✓
7. B updates last_convert = 1001 ✓
Result: BOTH succeed if both paid (CORRECT!)

But if same tx used twice:
1. A locks row, reads last_convert = 900 ✓
2. A checks: 1000 > 900 ✓
3. A updates last_convert = 1000 ✓
4. A releases lock
5. B locks row, reads last_convert = 1000
6. B checks: 1000 > 1000 ✗
7. B rejects
Result: Only A succeeds (CORRECT!)
```

---

## 🚨 Error Scenarios & Handling

### Scenario 1: Transaction Fails
```
User → Blockchain: payToConvertXP()
Blockchain → User: ✗ Transaction failed

Frontend:
- Show error: "Payment transaction failed"
- Allow retry
- Don't call API
```

### Scenario 2: Transaction Succeeds, API Fails
```
User → Blockchain: payToConvertXP() ✓
User → API: convert-xp ✗ (network error)

Frontend:
- Store txHash in localStorage
- Show error: "Conversion failed, retrying..."
- Add "Resume Conversion" button
- Retry with same txHash

Backend:
- Timestamp check still works
- Same tx can be used if not yet converted
```

### Scenario 3: Replay Attack
```
Attacker → API: Old txHash from previous conversion

Backend:
- Fetch tx timestamp: 1704103200
- Fetch last_convert: 1705329000
- Check: 1704103200 > 1705329000 ✗
- Reject: "Payment already used"
```

### Scenario 4: Insufficient Payment
```
User → Blockchain: payToConvertXP(0.05 USD) ✓
User → API: convert-xp

Backend:
- Verify tx: amount = 0.05 USD
- Check: 0.05 < 0.08 ✗
- Reject: "Insufficient payment amount"
```

---

## 📈 Monitoring & Metrics

### Key Metrics to Track
```
1. Conversion Success Rate
   - Total conversions / Total attempts
   - Target: >99%

2. Average Conversion Time
   - Time from payment to completion
   - Target: <5 seconds

3. Rejection Reasons
   - Timestamp check failures
   - Amount validation failures
   - Transaction verification failures

4. Revenue Tracking
   - Total payments received
   - Average payment amount
   - Payment amount distribution

5. Security Metrics
   - Replay attack attempts
   - Invalid transaction attempts
   - Concurrent request handling
```

### Monitoring Queries
```sql
-- Conversion success rate (last 24 hours)
SELECT 
  COUNT(*) FILTER (WHERE result = 'success') as successful,
  COUNT(*) FILTER (WHERE result = 'rejected') as rejected,
  COUNT(*) as total,
  ROUND(100.0 * COUNT(*) FILTER (WHERE result = 'success') / COUNT(*), 2) as success_rate
FROM xp_conversion_audit
WHERE created_at > NOW() - INTERVAL '24 hours';

-- Top rejection reasons
SELECT 
  rejection_reason,
  COUNT(*) as count
FROM xp_conversion_audit
WHERE result = 'rejected'
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY rejection_reason
ORDER BY count DESC;

-- Revenue tracking
SELECT 
  DATE(created_at) as date,
  COUNT(*) as conversions,
  SUM(payment_amount_usd) as total_revenue_usd,
  AVG(payment_amount_usd) as avg_payment_usd
FROM xp_conversion_audit
WHERE result = 'success'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

---

## ✅ Implementation Checklist

### Smart Contract
- [ ] Add `payToConvertXP()` function
- [ ] Add `XPConversionPayment` event
- [ ] Test on local network
- [ ] Deploy to testnet
- [ ] Verify on testnet
- [ ] Deploy to mainnet
- [ ] Verify on mainnet

### Backend
- [ ] Create `transaction-verification.ts`
- [ ] Implement `verifyConversionPayment()`
- [ ] Update `convert-xp/route.ts`
- [ ] Add timestamp comparison logic
- [ ] Add payment amount validation
- [ ] Add error handling
- [ ] Add audit logging (optional)
- [ ] Write unit tests
- [ ] Write integration tests

### Frontend
- [ ] Create `game-payment-service.ts`
- [ ] Implement `payForXPConversion()`
- [ ] Update `XPBridge.tsx`
- [ ] Add payment flow UI
- [ ] Add loading states
- [ ] Add error handling
- [ ] Add localStorage backup
- [ ] Add "Resume Conversion" feature
- [ ] Test on testnet
- [ ] Test error scenarios

### Testing
- [ ] Test normal conversion flow
- [ ] Test replay attack prevention
- [ ] Test concurrent requests
- [ ] Test insufficient payment
- [ ] Test invalid transaction
- [ ] Test network failures
- [ ] Test localStorage recovery
- [ ] Load testing

### Deployment
- [ ] Update `.env` variables
- [ ] Deploy smart contract
- [ ] Update contract address in config
- [ ] Deploy backend changes
- [ ] Deploy frontend changes
- [ ] Smoke test on production
- [ ] Monitor for issues

### Documentation
- [ ] Update README
- [ ] Document API changes
- [ ] Document security model
- [ ] Create user guide
- [ ] Create troubleshooting guide

---

This architecture ensures a secure, scalable, and user-friendly XP conversion system with payment verification!
