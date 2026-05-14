# XP Conversion Payment - Testing Guide

## 🧪 Complete Testing Checklist

---

## Phase 1: Smart Contract Testing (Testnet)

### 1.1 Deploy Contract
```bash
# Deploy to Ink testnet
npx hardhat run scripts/deploy-game-payment.js --network ink-testnet

# Note the deployed contract address
# Update .env.local:
NEXT_PUBLIC_GAME_PAYMENT_CONTRACT=0xYourTestnetContractAddress
```

### 1.2 Test payToConvertXP Function
```bash
# Using Hardhat console or Remix
# Call payToConvertXP with 0.1 USD worth of ETH
# Verify:
- ✅ Transaction succeeds
- ✅ XPConversionPayment event is emitted
- ✅ totalCollected increases
- ✅ Contract balance increases
```

### 1.3 Test Edge Cases
```bash
# Test with 0 value
- ❌ Should revert with "Payment amount must be greater than 0"

# Test with very small amount
- ✅ Should succeed (any amount > 0)

# Test with large amount
- ✅ Should succeed
```

---

## Phase 2: Backend Testing

### 2.1 Test Status Endpoint
```bash
# Test authenticated request
curl -X GET http://localhost:3000/api/bridge/convert-xp/status \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN"

# Expected response:
{
  "lastConvert": "2025-01-15T14:30:00.000Z" or null,
  "currentXP": 5000,
  "currentPoints": 200
}

# Test unauthenticated request
- ❌ Should return 401 Unauthorized
```

### 2.2 Test Transaction Verification Service
```typescript
// In a test file or console
import { verifyConversionPayment } from '@/lib/services/transaction-verification';

// Test with valid transaction
const result = await verifyConversionPayment(
  '0xValidTxHash',
  '0xUserWalletAddress'
);

// Verify:
- ✅ isValid = true
- ✅ timestamp is correct
- ✅ amount is correct
- ✅ amountInUSD is calculated
- ✅ from matches user wallet
- ✅ to matches contract address

// Test with invalid transaction
- ❌ isValid = false

// Test with wrong wallet
- ❌ isValid = false (from doesn't match)

// Test with wrong contract
- ❌ isValid = false (to doesn't match)
```

### 2.3 Test Convert XP Endpoint

#### Test 1: Successful Conversion
```bash
# Prerequisites:
- User is authenticated
- User has sufficient XP (e.g., 1000 XP)
- User has paid 0.1 USD to contract
- Transaction is confirmed

# Request:
POST /api/bridge/convert-xp
{
  "xpAmount": 1000,
  "txHash": "0xValidTxHash"
}

# Expected response:
{
  "success": true,
  "message": "Successfully converted 1000 XP to 100 points!",
  "data": {
    "newXP": 4000,
    "newPoints": 300,
    "pointsAdded": 100
  }
}

# Verify in database:
- ✅ game_score decreased by 1000
- ✅ points increased by 100
- ✅ last_convert updated to transaction timestamp
```

#### Test 2: Unauthenticated Request
```bash
# Request without session
- ❌ Should return 401 Unauthorized
```

#### Test 3: Invalid Transaction Hash
```bash
POST /api/bridge/convert-xp
{
  "xpAmount": 1000,
  "txHash": "0xInvalidTxHash"
}

# Expected response:
- ❌ 400 Bad Request
- Error: "Invalid transaction"
```

#### Test 4: Wrong Wallet (Security Test)
```bash
# User A pays
# User B tries to use User A's txHash

POST /api/bridge/convert-xp
{
  "xpAmount": 1000,
  "txHash": "0xUserATxHash"
}

# Expected response:
- ❌ 400 Bad Request
- Error: "Invalid transaction. Please ensure you paid with your connected wallet"
```

#### Test 5: Insufficient Payment
```bash
# User pays 0.05 USD (too low)

POST /api/bridge/convert-xp
{
  "xpAmount": 1000,
  "txHash": "0xLowPaymentTxHash"
}

# Expected response:
- ❌ 400 Bad Request
- Error: "Payment amount must be approximately 0.1 USD (received 0.05 USD)"
```

#### Test 6: Replay Attack
```bash
# User converts successfully
# User tries to use same txHash again

POST /api/bridge/convert-xp
{
  "xpAmount": 1000,
  "txHash": "0xAlreadyUsedTxHash"
}

# Expected response:
- ❌ 400 Bad Request
- Error: "This transaction is older than your last conversion. Payment already used."
```

#### Test 7: Insufficient XP
```bash
# User has 500 XP
# User tries to convert 1000 XP

POST /api/bridge/convert-xp
{
  "xpAmount": 1000,
  "txHash": "0xValidTxHash"
}

# Expected response:
- ❌ 400 Bad Request
- Error: "Insufficient XP. You have 500 XP but need 1000 XP."
```

---

## Phase 3: Frontend Testing

### 3.1 Test Normal Conversion Flow

#### Steps:
1. Navigate to profile page
2. Ensure you have XP (e.g., 1000 XP)
3. Click "Convert All XP" button
4. Approve transaction in wallet
5. Wait for transaction confirmation
6. Wait for conversion to complete

#### Verify:
- ✅ Button shows "Processing Payment..." during payment
- ✅ Button shows "Converting..." after payment
- ✅ Success message appears
- ✅ XP balance updates
- ✅ Points balance updates
- ✅ localStorage is cleared
- ✅ No errors in console

### 3.2 Test Recovery Mechanism

#### Scenario 1: Network Error After Payment
1. Pay for conversion
2. Disconnect internet before API call completes
3. Refresh page
4. Verify:
   - ✅ "Incomplete Conversion Detected" banner appears
   - ✅ "Resume Conversion" button is visible
5. Click "Resume Conversion"
6. Verify:
   - ✅ Conversion completes successfully
   - ✅ localStorage is cleared
   - ✅ Balances update

#### Scenario 2: Page Refresh After Payment
1. Pay for conversion
2. Immediately refresh page (before API call)
3. Verify:
   - ✅ "Incomplete Conversion Detected" banner appears
4. Click "Resume Conversion"
5. Verify:
   - ✅ Conversion completes successfully

#### Scenario 3: Already Processed
1. Complete a conversion successfully
2. Manually add old txHash to localStorage:
```javascript
localStorage.setItem('pendingConversionTx', JSON.stringify({
  txHash: '0xOldTxHash',
  timestamp: 1704103200,
  xpAmount: 1000,
  paymentAmount: 0.1,
  createdAt: Date.now()
}));
```
3. Refresh page
4. Verify:
   - ✅ No banner appears
   - ✅ localStorage is automatically cleared

#### Scenario 4: Old Pending (>24 hours)
1. Manually add old pending conversion:
```javascript
localStorage.setItem('pendingConversionTx', JSON.stringify({
  txHash: '0xOldTxHash',
  timestamp: 1704103200,
  xpAmount: 1000,
  paymentAmount: 0.1,
  createdAt: Date.now() - (25 * 60 * 60 * 1000) // 25 hours ago
}));
```
2. Refresh page
3. Verify:
   - ✅ No banner appears
   - ✅ localStorage is automatically cleared

### 3.3 Test Error Handling

#### Test 1: Wallet Not Connected
1. Disconnect wallet
2. Try to convert
3. Verify:
   - ✅ Button is disabled
   - ✅ Message: "Please connect your wallet to convert XP"

#### Test 2: No XP
1. Ensure XP balance is 0
2. Try to convert
3. Verify:
   - ✅ Button is disabled
   - ✅ Status shows "No XP available"

#### Test 3: Transaction Rejected
1. Click "Convert All XP"
2. Reject transaction in wallet
3. Verify:
   - ✅ Error message appears
   - ✅ Can retry
   - ✅ No localStorage entry created

#### Test 4: Transaction Failed
1. Send transaction with insufficient gas
2. Verify:
   - ✅ Error message appears
   - ✅ Can retry

### 3.4 Test Loading States

#### Verify:
- ✅ "Loading..." shows while fetching ETH price
- ✅ "Processing Payment..." shows during payment
- ✅ "Converting..." shows during API call
- ✅ Skeleton loader shows while checking pending conversion
- ✅ Button is disabled during all loading states

### 3.5 Test UI/UX

#### Verify:
- ✅ ETH price displays correctly
- ✅ Payment amount shows (~X ETH)
- ✅ Conversion rate is clear (1000 XP = 100 points)
- ✅ Current balances display correctly
- ✅ Success animation plays
- ✅ Error messages are clear
- ✅ Responsive on mobile
- ✅ Dark mode works correctly

---

## Phase 4: Integration Testing

### 4.1 End-to-End Flow
1. User has 5000 XP, 200 points
2. User clicks "Convert All XP"
3. User pays 0.1 USD
4. Transaction confirms
5. API processes conversion
6. User now has 0 XP, 700 points

#### Verify:
- ✅ All steps complete successfully
- ✅ Database updated correctly
- ✅ No errors in logs
- ✅ Total time < 30 seconds

### 4.2 Concurrent Requests
1. User A and User B both convert at same time
2. Verify:
   - ✅ Both conversions succeed
   - ✅ No race conditions
   - ✅ Database is consistent

### 4.3 Multiple Conversions
1. User converts 1000 XP
2. User immediately pays again
3. User converts another 1000 XP
4. Verify:
   - ✅ Both conversions succeed
   - ✅ No cooldown restriction
   - ✅ Timestamps are correct

---

## Phase 5: Security Testing

### 5.1 Replay Attack
1. User converts successfully
2. Try to reuse same txHash
3. Verify:
   - ❌ Rejected with "Payment already used"

### 5.2 Cross-User Attack
1. User A pays and converts
2. User B tries to use User A's txHash
3. Verify:
   - ❌ Rejected with "Invalid transaction"

### 5.3 Fake Transaction
1. Try to convert with non-existent txHash
2. Verify:
   - ❌ Rejected with "Invalid transaction"

### 5.4 Wrong Contract
1. Pay to different contract
2. Try to convert with that txHash
3. Verify:
   - ❌ Rejected with "Invalid transaction"

### 5.5 Session Manipulation
1. Try to call API without session
2. Verify:
   - ❌ Rejected with 401 Unauthorized

---

## Phase 6: Performance Testing

### 6.1 Load Testing
- Test with 10 concurrent conversions
- Test with 100 concurrent conversions
- Verify:
  - ✅ All succeed
  - ✅ Response time < 5 seconds
  - ✅ No database deadlocks

### 6.2 Network Latency
- Test with slow network (throttle to 3G)
- Verify:
  - ✅ Loading states work correctly
  - ✅ Timeouts are handled
  - ✅ Recovery mechanism works

---

## Phase 7: Edge Cases

### 7.1 ETH Price Spike
1. ETH price increases 30% during payment
2. Verify:
   - ✅ Payment amount validation handles it (20% tolerance)
   - ❌ Or rejects if outside tolerance

### 7.2 Transaction Pending
1. Submit transaction
2. Before confirmation, try to check status
3. Verify:
   - ✅ Appropriate message shown
   - ✅ Can wait for confirmation

### 7.3 Wallet Switch
1. Start conversion with Wallet A
2. Switch to Wallet B
3. Verify:
   - ✅ Pending conversion is cleared
   - ✅ No errors

### 7.4 Browser Storage Disabled
1. Disable localStorage
2. Try to convert
3. Verify:
   - ✅ Conversion still works
   - ⚠️ Recovery mechanism won't work (acceptable)

---

## Test Results Template

```markdown
## Test Results - [Date]

### Environment
- Network: Testnet / Mainnet
- Contract Address: 0x...
- Tester: [Name]

### Smart Contract
- [ ] Deploy successful
- [ ] payToConvertXP works
- [ ] Events emitted correctly
- [ ] Edge cases handled

### Backend
- [ ] Status endpoint works
- [ ] Transaction verification works
- [ ] Convert endpoint works
- [ ] Security checks pass
- [ ] Error handling works

### Frontend
- [ ] Normal flow works
- [ ] Recovery mechanism works
- [ ] Error handling works
- [ ] Loading states work
- [ ] UI/UX is good

### Integration
- [ ] End-to-end flow works
- [ ] Concurrent requests work
- [ ] Multiple conversions work

### Security
- [ ] Replay attacks blocked
- [ ] Cross-user attacks blocked
- [ ] Fake transactions blocked
- [ ] Session required

### Performance
- [ ] Response time < 5s
- [ ] Handles load well
- [ ] Network latency handled

### Issues Found
1. [Issue description]
2. [Issue description]

### Status
- ✅ Ready for production
- ⚠️ Minor issues to fix
- ❌ Major issues found
```

---

## Automated Testing (Future)

### Unit Tests
```typescript
// Example test structure
describe('Transaction Verification', () => {
  it('should verify valid transaction', async () => {
    const result = await verifyConversionPayment(validTxHash, userWallet);
    expect(result.isValid).toBe(true);
  });
  
  it('should reject wrong wallet', async () => {
    const result = await verifyConversionPayment(txHash, wrongWallet);
    expect(result.isValid).toBe(false);
  });
});
```

### Integration Tests
```typescript
describe('XP Conversion Flow', () => {
  it('should complete full conversion', async () => {
    // Pay
    const txHash = await payForXPConversion(0.1, 3000);
    
    // Convert
    const response = await fetch('/api/bridge/convert-xp', {
      method: 'POST',
      body: JSON.stringify({ xpAmount: 1000, txHash })
    });
    
    expect(response.ok).toBe(true);
  });
});
```

---

## Monitoring Checklist

After deployment, monitor:
- [ ] Conversion success rate
- [ ] Average conversion time
- [ ] Error rates by type
- [ ] Recovery mechanism usage
- [ ] Payment amounts received
- [ ] Gas costs
- [ ] User feedback

---

**Happy Testing! 🧪**
