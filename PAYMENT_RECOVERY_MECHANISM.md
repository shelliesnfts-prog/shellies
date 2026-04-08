# Payment Recovery Mechanism - Handle Interrupted Conversions

## 🎯 Problem Statement

User pays 0.1 USD → Transaction confirmed → Client saves txHash to localStorage → **Internet issue / Page refresh / Error occurs** → User returns to profile page → Should NOT be asked to pay again!

---

## The Issue

### Scenario: Interrupted Conversion
```
1. User clicks "Convert XP"
2. User pays 0.1 USD via wallet
3. Transaction confirmed → txHash: 0xabc123
4. Client saves to localStorage: "latestConvertTxHash" = "0xabc123"
5. Client calls API: /api/bridge/convert-xp
6. ❌ Network error / Page refresh / Browser crash
7. User returns to profile page
8. ❌ BAD UX: Asked to pay again (but already paid!)
```

### What Should Happen
```
1-4. Same as above
5. Client calls API: /api/bridge/convert-xp
6. ❌ Network error / Page refresh / Browser crash
7. User returns to profile page
8. ✅ Client checks localStorage for pending transaction
9. ✅ Client verifies if transaction was already processed
10. ✅ If not processed: Resume conversion with existing txHash
11. ✅ If processed: Clear localStorage and show success
```

---

## Solution: Client-Side Recovery Logic

### 1. localStorage Structure

```typescript
// Store pending conversion transaction
interface PendingConversion {
  txHash: string;
  timestamp: number;        // When payment was made
  xpAmount: number;         // How much XP user wanted to convert
  paymentAmount: number;    // How much USD was paid
  createdAt: number;        // When this was saved (Date.now())
}

// localStorage key
const PENDING_CONVERSION_KEY = 'pendingConversionTx';
```

### 2. Save Transaction After Payment

```typescript
// After successful payment transaction
const savePendingConversion = (
  txHash: string,
  txTimestamp: number,
  xpAmount: number,
  paymentAmount: number
) => {
  const pending: PendingConversion = {
    txHash,
    timestamp: txTimestamp,
    xpAmount,
    paymentAmount,
    createdAt: Date.now()
  };
  
  localStorage.setItem(PENDING_CONVERSION_KEY, JSON.stringify(pending));
};
```

### 3. Check for Pending Conversion on Mount

```typescript
// In XPBridge component useEffect
useEffect(() => {
  const checkPendingConversion = async () => {
    if (!address || !isConnected) return;
    
    // Check if there's a pending conversion
    const pendingStr = localStorage.getItem(PENDING_CONVERSION_KEY);
    if (!pendingStr) return;
    
    try {
      const pending: PendingConversion = JSON.parse(pendingStr);
      
      // Validate pending conversion is not too old (e.g., 24 hours)
      const MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours
      if (Date.now() - pending.createdAt > MAX_AGE) {
        // Too old, clear it
        localStorage.removeItem(PENDING_CONVERSION_KEY);
        return;
      }
      
      // Fetch user's last_convert from database
      const response = await fetch(`/api/bridge/convert-xp/status?walletAddress=${address}`);
      const data = await response.json();
      
      if (!response.ok) {
        console.error('Failed to check conversion status');
        return;
      }
      
      const lastConvertTime = data.lastConvert 
        ? new Date(data.lastConvert).getTime() 
        : 0;
      
      const pendingTxTime = pending.timestamp * 1000; // Convert to milliseconds
      
      // Compare timestamps (same logic as server)
      if (pendingTxTime > lastConvertTime) {
        // Transaction was NOT processed yet
        // Show "Resume Conversion" UI
        setPendingConversion(pending);
        setShowResumeConversion(true);
      } else {
        // Transaction was already processed
        // Clear localStorage
        localStorage.removeItem(PENDING_CONVERSION_KEY);
      }
      
    } catch (error) {
      console.error('Error checking pending conversion:', error);
      // Don't clear localStorage in case of error - user can retry
    }
  };
  
  checkPendingConversion();
}, [address, isConnected]);
```

### 4. Resume Conversion Function

```typescript
const resumeConversion = async (pending: PendingConversion) => {
  setIsConverting(true);
  setConversionError(null);
  
  try {
    // Call API with existing txHash
    const response = await fetch('/api/bridge/convert-xp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        xpAmount: pending.xpAmount,
        txHash: pending.txHash
      }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Conversion failed');
    }
    
    // Success! Clear localStorage
    localStorage.removeItem(PENDING_CONVERSION_KEY);
    
    // Update UI
    onConversionComplete(data.data.newXP, data.data.newPoints);
    setShowSuccess(true);
    setShowResumeConversion(false);
    setPendingConversion(null);
    
  } catch (error) {
    console.error('Resume conversion error:', error);
    setConversionError(error.message || 'Failed to resume conversion');
  } finally {
    setIsConverting(false);
  }
};
```

### 5. New API Endpoint for Status Check

```typescript
// src/app/api/bridge/convert-xp/status/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

const supabaseService = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const session = await getServerSession(authOptions);
    
    if (!session?.address) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }
    
    const walletAddress = session.address as string;
    
    // Get user's last_convert timestamp
    const { data: user, error } = await supabaseService
      .from('shellies_raffle_users')
      .select('last_convert, game_score, points')
      .eq('wallet_address', walletAddress)
      .single();
    
    if (error || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      lastConvert: user.last_convert,
      currentXP: user.game_score || 0,
      currentPoints: user.points || 0
    });
    
  } catch (error) {
    console.error('Error checking conversion status:', error);
    return NextResponse.json(
      { error: 'Failed to check status' },
      { status: 500 }
    );
  }
}
```

---

## Complete Flow Diagram

### Normal Flow (No Interruption)
```
User clicks "Convert XP"
    ↓
User pays 0.1 USD
    ↓
Transaction confirmed → txHash: 0xabc123
    ↓
Save to localStorage: { txHash, timestamp, xpAmount }
    ↓
Call API: /api/bridge/convert-xp
    ↓
✅ Success
    ↓
Clear localStorage
    ↓
Update UI
```

### Interrupted Flow (Network Error)
```
User clicks "Convert XP"
    ↓
User pays 0.1 USD
    ↓
Transaction confirmed → txHash: 0xabc123
    ↓
Save to localStorage: { txHash, timestamp, xpAmount }
    ↓
Call API: /api/bridge/convert-xp
    ↓
❌ Network error / Page refresh
    ↓
localStorage still has pending transaction
    ↓
User returns to profile page
    ↓
Component mounts → Check localStorage
    ↓
Found pending transaction
    ↓
Fetch user's last_convert from API
    ↓
Compare: pending.timestamp > last_convert?
    ↓
YES → Show "Resume Conversion" button
    ↓
User clicks "Resume Conversion"
    ↓
Call API with existing txHash
    ↓
✅ Success
    ↓
Clear localStorage
    ↓
Update UI
```

### Already Processed Flow
```
User returns to profile page
    ↓
Component mounts → Check localStorage
    ↓
Found pending transaction
    ↓
Fetch user's last_convert from API
    ↓
Compare: pending.timestamp > last_convert?
    ↓
NO → Transaction already processed
    ↓
Clear localStorage
    ↓
Show normal UI (no resume button)
```

---

## UI Implementation

### State Management

```typescript
// Add to XPBridge component
const [pendingConversion, setPendingConversion] = useState<PendingConversion | null>(null);
const [showResumeConversion, setShowResumeConversion] = useState(false);
const [isCheckingPending, setIsCheckingPending] = useState(true);
```

### Resume Conversion UI

```typescript
{showResumeConversion && pendingConversion && (
  <div className={`rounded-xl p-4 border ${
    isDarkMode 
      ? 'bg-yellow-900/20 border-yellow-500/30' 
      : 'bg-yellow-50 border-yellow-200'
  }`}>
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0">
        <svg className="w-6 h-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <div className="flex-1">
        <h4 className={`text-sm font-semibold mb-1 ${
          isDarkMode ? 'text-yellow-400' : 'text-yellow-800'
        }`}>
          Incomplete Conversion Detected
        </h4>
        <p className={`text-xs mb-3 ${
          isDarkMode ? 'text-yellow-300' : 'text-yellow-700'
        }`}>
          You paid for a conversion but it wasn't completed. 
          Click below to resume without paying again.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => resumeConversion(pendingConversion)}
            disabled={isConverting}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isDarkMode
                ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                : 'bg-yellow-600 hover:bg-yellow-700 text-white'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isConverting ? 'Resuming...' : 'Resume Conversion'}
          </button>
          <button
            onClick={() => {
              localStorage.removeItem(PENDING_CONVERSION_KEY);
              setPendingConversion(null);
              setShowResumeConversion(false);
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isDarkMode
                ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
            }`}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  </div>
)}
```

---

## Edge Cases & Handling

### 1. Transaction Pending (Not Yet Confirmed)
```typescript
// When checking pending conversion
const tx = await client.getTransaction({ hash: pending.txHash });
const receipt = await client.getTransactionReceipt({ hash: pending.txHash });

if (!receipt) {
  // Transaction still pending
  setConversionError('Transaction is still pending. Please wait for confirmation.');
  return;
}
```

### 2. Transaction Failed on Blockchain
```typescript
if (receipt.status === 'reverted') {
  // Transaction failed
  localStorage.removeItem(PENDING_CONVERSION_KEY);
  setConversionError('Your payment transaction failed. Please try again.');
  return;
}
```

### 3. Multiple Pending Conversions
```typescript
// Only keep the most recent one
const pending = JSON.parse(localStorage.getItem(PENDING_CONVERSION_KEY));

// If user tries to start new conversion while one is pending
if (pending) {
  const confirmNew = window.confirm(
    'You have a pending conversion. Starting a new one will discard the pending one. Continue?'
  );
  
  if (!confirmNew) {
    return;
  }
  
  // User confirmed, clear old pending
  localStorage.removeItem(PENDING_CONVERSION_KEY);
}
```

### 4. localStorage Quota Exceeded
```typescript
const savePendingConversion = (data: PendingConversion) => {
  try {
    localStorage.setItem(PENDING_CONVERSION_KEY, JSON.stringify(data));
  } catch (error) {
    if (error.name === 'QuotaExceededError') {
      console.error('localStorage quota exceeded');
      // Fallback: Store in memory only
      window.pendingConversion = data;
    }
  }
};
```

### 5. User Switches Wallet
```typescript
// Check if pending conversion belongs to current wallet
const checkPendingConversion = async () => {
  const pending = getPendingConversion();
  if (!pending) return;
  
  // Verify transaction sender matches current wallet
  const tx = await client.getTransaction({ hash: pending.txHash });
  
  if (tx.from.toLowerCase() !== address.toLowerCase()) {
    // Pending conversion is for different wallet
    localStorage.removeItem(PENDING_CONVERSION_KEY);
    return;
  }
  
  // Continue with recovery...
};
```

---

## Testing Checklist

### Happy Path
- [ ] User pays → Conversion succeeds → localStorage cleared
- [ ] User pays → Page refresh → Resume button appears
- [ ] User clicks resume → Conversion succeeds → localStorage cleared

### Error Scenarios
- [ ] User pays → Network error → Resume button appears
- [ ] User pays → Browser crash → Resume button appears on return
- [ ] User pays → Transaction pending → Show pending message
- [ ] User pays → Transaction failed → Show error, clear localStorage

### Edge Cases
- [ ] Pending conversion older than 24 hours → Auto-clear
- [ ] Pending conversion already processed → Auto-clear
- [ ] User switches wallet → Clear pending conversion
- [ ] Multiple pending conversions → Keep most recent
- [ ] localStorage quota exceeded → Graceful fallback

### Security
- [ ] Cannot resume with another user's transaction
- [ ] Cannot resume with fake transaction hash
- [ ] Cannot resume with already-used transaction
- [ ] Session authentication still required

---

## Benefits

### User Experience
✅ No need to pay twice if interrupted
✅ Clear indication of pending conversion
✅ One-click resume functionality
✅ Automatic cleanup of old pending conversions

### Security
✅ Same validation logic as server
✅ Cannot bypass payment requirement
✅ Cannot use other user's transactions
✅ Timestamp verification still applies

### Reliability
✅ Handles network errors gracefully
✅ Handles page refreshes
✅ Handles browser crashes
✅ Handles wallet switches

---

## Implementation Priority

### Phase 1 (Must Have)
1. ✅ Save txHash to localStorage after payment
2. ✅ Check localStorage on component mount
3. ✅ Compare with last_convert timestamp
4. ✅ Show resume button if needed
5. ✅ Resume conversion with existing txHash

### Phase 2 (Should Have)
1. ✅ Create status check API endpoint
2. ✅ Handle transaction pending state
3. ✅ Handle transaction failed state
4. ✅ Auto-clear old pending conversions

### Phase 3 (Nice to Have)
1. ✅ Handle wallet switches
2. ✅ Handle multiple pending conversions
3. ✅ localStorage quota handling
4. ✅ Analytics on recovery success rate

---

## Code Summary

### Key Functions
```typescript
// 1. Save after payment
savePendingConversion(txHash, timestamp, xpAmount, paymentAmount)

// 2. Check on mount
checkPendingConversion() → Shows resume button if needed

// 3. Resume conversion
resumeConversion(pending) → Calls API with existing txHash

// 4. Clear after success
localStorage.removeItem(PENDING_CONVERSION_KEY)
```

### localStorage Key
```typescript
const PENDING_CONVERSION_KEY = 'pendingConversionTx';
```

### Comparison Logic (Same as Server)
```typescript
const pendingTxTime = pending.timestamp * 1000;
const lastConvertTime = new Date(user.last_convert).getTime();

if (pendingTxTime > lastConvertTime) {
  // Not processed yet → Show resume button
} else {
  // Already processed → Clear localStorage
}
```

---

This recovery mechanism ensures users never lose their payment and provides a smooth experience even when interruptions occur!
