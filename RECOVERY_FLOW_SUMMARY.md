# Payment Recovery Flow - Quick Summary

## 🎯 Goal
Prevent users from paying twice if conversion is interrupted by network issues, page refresh, or browser crash.

---

## 📦 localStorage Structure

```typescript
// Key: 'pendingConversionTx'
{
  txHash: "0xabc123...",      // Payment transaction hash
  timestamp: 1705329000,       // Blockchain timestamp (seconds)
  xpAmount: 1000,              // XP to convert
  paymentAmount: 0.1,          // USD paid
  createdAt: 1705329000000     // When saved (milliseconds)
}
```

---

## 🔄 Complete Flow

### 1. Normal Flow (No Interruption)
```
User pays → Save to localStorage → Call API → ✅ Success → Clear localStorage
```

### 2. Interrupted Flow
```
User pays → Save to localStorage → Call API → ❌ Error/Refresh
    ↓
User returns to profile
    ↓
Check localStorage → Found pending
    ↓
Fetch last_convert from API
    ↓
Compare: pending.timestamp > last_convert?
    ↓
YES → Show "Resume Conversion" button
    ↓
User clicks Resume → Call API with existing txHash
    ↓
✅ Success → Clear localStorage
```

### 3. Already Processed
```
User returns to profile
    ↓
Check localStorage → Found pending
    ↓
Fetch last_convert from API
    ↓
Compare: pending.timestamp > last_convert?
    ↓
NO → Already processed → Clear localStorage
```

---

## 🔑 Key Functions

### 1. Save After Payment
```typescript
const savePendingConversion = (txHash, timestamp, xpAmount, paymentAmount) => {
  localStorage.setItem('pendingConversionTx', JSON.stringify({
    txHash,
    timestamp,
    xpAmount,
    paymentAmount,
    createdAt: Date.now()
  }));
};
```

### 2. Check on Mount
```typescript
useEffect(() => {
  const checkPending = async () => {
    const pending = JSON.parse(localStorage.getItem('pendingConversionTx'));
    if (!pending) return;
    
    // Check if too old (>24 hours)
    if (Date.now() - pending.createdAt > 24 * 60 * 60 * 1000) {
      localStorage.removeItem('pendingConversionTx');
      return;
    }
    
    // Fetch user's last_convert
    const response = await fetch(`/api/bridge/convert-xp/status`);
    const data = await response.json();
    
    const lastConvertTime = data.lastConvert 
      ? new Date(data.lastConvert).getTime() 
      : 0;
    const pendingTime = pending.timestamp * 1000;
    
    // Compare timestamps
    if (pendingTime > lastConvertTime) {
      // Not processed yet
      setShowResumeButton(true);
      setPendingConversion(pending);
    } else {
      // Already processed
      localStorage.removeItem('pendingConversionTx');
    }
  };
  
  checkPending();
}, [address]);
```

### 3. Resume Conversion
```typescript
const resumeConversion = async (pending) => {
  const response = await fetch('/api/bridge/convert-xp', {
    method: 'POST',
    body: JSON.stringify({
      xpAmount: pending.xpAmount,
      txHash: pending.txHash
    })
  });
  
  if (response.ok) {
    localStorage.removeItem('pendingConversionTx');
    // Update UI
  }
};
```

---

## 🎨 UI Component

```tsx
{showResumeButton && pendingConversion && (
  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
    <div className="flex items-start gap-3">
      <AlertIcon />
      <div>
        <h4 className="font-semibold text-yellow-800">
          Incomplete Conversion Detected
        </h4>
        <p className="text-sm text-yellow-700 mt-1">
          You paid for a conversion but it wasn't completed. 
          Click below to resume without paying again.
        </p>
        <div className="flex gap-2 mt-3">
          <button 
            onClick={() => resumeConversion(pendingConversion)}
            className="bg-yellow-600 text-white px-4 py-2 rounded-lg"
          >
            Resume Conversion
          </button>
          <button 
            onClick={() => {
              localStorage.removeItem('pendingConversionTx');
              setShowResumeButton(false);
            }}
            className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg"
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

## 🔒 Security

### Client-Side Validation
```typescript
// Same logic as server
if (pending.timestamp > last_convert) {
  // Not processed yet → Show resume button
} else {
  // Already processed → Clear localStorage
}
```

### Server-Side Validation (Still Required)
```typescript
// Server still validates everything:
✓ Session authentication
✓ tx.from === session.address
✓ tx.timestamp > last_convert
✓ Payment amount correct
✓ Transaction successful
```

---

## ✅ Benefits

### User Experience
- ✅ No double payment
- ✅ Clear recovery UI
- ✅ One-click resume
- ✅ Auto-cleanup

### Reliability
- ✅ Handles network errors
- ✅ Handles page refresh
- ✅ Handles browser crash
- ✅ Handles wallet switch

### Security
- ✅ Same validation as server
- ✅ Cannot bypass payment
- ✅ Cannot use other's tx
- ✅ Timestamp verification

---

## 📝 Implementation Checklist

### Backend
- [ ] Create `/api/bridge/convert-xp/status` endpoint
- [ ] Return `last_convert` timestamp
- [ ] Add session authentication

### Frontend
- [ ] Save to localStorage after payment
- [ ] Check localStorage on mount
- [ ] Fetch `last_convert` from API
- [ ] Compare timestamps
- [ ] Show resume button if needed
- [ ] Implement resume function
- [ ] Clear localStorage on success
- [ ] Auto-clear old pending (>24h)

### Testing
- [ ] Test normal flow
- [ ] Test interrupted flow
- [ ] Test already processed
- [ ] Test old pending (>24h)
- [ ] Test wallet switch
- [ ] Test network errors

---

## 🚀 Quick Start

### 1. After Payment
```typescript
// Save to localStorage
savePendingConversion(txHash, timestamp, xpAmount, 0.1);
```

### 2. On Component Mount
```typescript
// Check for pending
useEffect(() => {
  checkPendingConversion();
}, [address]);
```

### 3. Show Resume UI
```typescript
{showResumeButton && <ResumeConversionUI />}
```

### 4. Resume Function
```typescript
const resume = () => resumeConversion(pendingConversion);
```

---

This ensures users never lose their payment and provides excellent UX! 🎉
