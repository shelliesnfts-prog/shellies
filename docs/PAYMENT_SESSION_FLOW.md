# Payment Session Flow & Error Handling

## Complete User Flow

### 1. Initial Page Load
```
User visits /portal/game
  ↓
Client checks server for active session (GET /api/game-session)
  ↓
If NO session → Show payment modal
If HAS session → Show game console
```

### 2. Payment Flow
```
User clicks "Pay to Play"
  ↓
Payment modal opens
  ↓
User signs transaction in wallet
  ↓
Transaction confirmed on blockchain
  ↓
Client creates server session (POST /api/game-session)
  ↓
Server validates and stores session
  ↓
Payment modal auto-closes (1.5s delay)
  ↓
Game console appears
```

### 3. Gameplay Flow
```
User plays game
  ↓
User achieves new high score
  ↓
Client submits score (POST /api/game-score)
  ↓
Server verifies active session
  ↓
If VALID → Score accepted ✓
If INVALID → 403 Forbidden ✗
```

### 4. Session Expiration Handling

#### Scenario A: Game Over (Normal)
```
User loses game
  ↓
Game sends GAME_OVER message
  ↓
Client clears server session (DELETE /api/game-session)
  ↓
"Payment Required" banner appears
  ↓
User clicks "Refresh" to pay again
```

#### Scenario B: Session Expires During Gameplay
```
User plays for 24+ hours (session expires)
  ↓
User achieves new score
  ↓
Client submits score (POST /api/game-score)
  ↓
Server returns 403 Forbidden (no active session)
  ↓
Client receives 403 error
  ↓
useGameScore hook dispatches 'paymentRequired' event
  ↓
Game page listens for event
  ↓
Payment modal automatically opens
  ↓
"Payment Required" banner appears in game console
```

#### Scenario C: User Tries to Manipulate Client
```
User opens DevTools
  ↓
User modifies sessionStorage or React state
  ↓
Game console appears (client-side only)
  ↓
User plays and achieves score
  ↓
Client submits score (POST /api/game-score)
  ↓
Server checks for active session
  ↓
NO SESSION FOUND → 403 Forbidden
  ↓
Score rejected, payment modal opens
  ↓
User must pay to continue
```

## Error Handling Implementation

### 1. useGameScore Hook
```typescript
// Detects 403 errors and dispatches custom event
if (response.status === 403) {
  setError('PAYMENT_REQUIRED');
  
  window.dispatchEvent(new CustomEvent('paymentRequired', {
    detail: { 
      message: 'Payment required to submit score',
      score 
    }
  }));
  
  return false;
}
```

### 2. Game Page Component
```typescript
// Listens for payment required events
useEffect(() => {
  const handlePaymentRequired = (event: CustomEvent) => {
    clearPaymentSession();
    setShowPaymentModal(true); // Auto-open payment modal
  };

  window.addEventListener('paymentRequired', handlePaymentRequired);
  return () => window.removeEventListener('paymentRequired', handlePaymentRequired);
}, []);
```

### 3. Game Console Component
```typescript
// Shows payment expired banner
useEffect(() => {
  const handlePaymentRequired = (event: CustomEvent) => {
    setShowPaymentExpired(true); // Show banner
    clearPaymentSession();
  };

  window.addEventListener('paymentRequired', handlePaymentRequired);
  return () => window.removeEventListener('paymentRequired', handlePaymentRequired);
}, []);
```

## User Experience

### Good UX ✓
- **Automatic modal opening**: When session expires, payment modal opens automatically
- **Clear messaging**: "Payment Required" banner explains what happened
- **No data loss**: Score is preserved locally even if submission fails
- **Smooth recovery**: User can pay and continue without losing progress

### What Users See

#### When Session Expires Mid-Game:
1. Yellow banner appears: "Payment Required - Your game session has ended"
2. Payment modal automatically opens
3. User can pay to continue
4. After payment, they can keep playing

#### When Trying to Bypass Payment:
1. Game appears to load (client-side)
2. When they try to submit score → Rejected
3. Payment modal opens automatically
4. Clear message: "No active game session found. Please pay to play first."

## API Response Codes

### GET /api/game-session
- **200 OK**: Returns session status
  ```json
  {
    "success": true,
    "hasActiveSession": true,
    "session": { "id": "...", "transactionHash": "...", "expiresAt": "..." }
  }
  ```

### POST /api/game-session
- **200 OK**: Session created successfully
- **400 Bad Request**: Invalid transaction or transaction already used
- **401 Unauthorized**: Not authenticated
- **500 Internal Server Error**: Database error

### POST /api/game-score
- **200 OK**: Score accepted
  ```json
  {
    "success": true,
    "game_score": 1234,
    "isNewBest": true
  }
  ```
- **403 Forbidden**: No active session (triggers payment modal)
  ```json
  {
    "success": false,
    "error": "No active game session found. Please pay to play first."
  }
  ```
- **401 Unauthorized**: Not authenticated
- **400 Bad Request**: Invalid score data

### DELETE /api/game-session
- **200 OK**: Session ended successfully
- **401 Unauthorized**: Not authenticated
- **500 Internal Server Error**: Database error

## Testing Checklist

### Manual Testing
- [ ] Load game page without payment → Modal appears
- [ ] Pay and verify game loads
- [ ] Play and submit score → Score accepted
- [ ] Game over → Session cleared, banner appears
- [ ] Refresh page after game over → Modal appears again
- [ ] Try to submit score without session → 403 error, modal opens

### Security Testing
- [ ] Modify sessionStorage → Score submission fails
- [ ] Modify React state → Score submission fails
- [ ] Call API directly without session → 403 error
- [ ] Try to reuse transaction hash → 400 error
- [ ] Wait 24 hours → Session expires, score fails

### UX Testing
- [ ] Payment modal auto-closes after payment
- [ ] Payment modal auto-opens on 403 error
- [ ] Banner appears when session expires
- [ ] Clear error messages displayed
- [ ] Smooth transition between states

## Event Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     User Actions                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Client Components                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Game Page   │  │ Game Console │  │ useGameScore │      │
│  │              │  │              │  │              │      │
│  │ - Checks     │  │ - Displays   │  │ - Submits    │      │
│  │   session    │  │   game       │  │   scores     │      │
│  │ - Shows      │  │ - Shows      │  │ - Handles    │      │
│  │   modal      │  │   banner     │  │   403        │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                  │                  │              │
│         └──────────────────┴──────────────────┘              │
│                            │                                 │
│                   Custom Event Bus                           │
│                  'paymentRequired'                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Endpoints                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ /game-       │  │ /game-       │  │ /game-       │      │
│  │  session     │  │  session     │  │  score       │      │
│  │  (GET)       │  │  (POST)      │  │  (POST)      │      │
│  │              │  │              │  │              │      │
│  │ Verify       │  │ Create       │  │ Submit       │      │
│  │ session      │  │ session      │  │ score        │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Database                                │
│          shellies_raffle_game_sessions                       │
│  ┌────────────────────────────────────────────────┐         │
│  │ id | wallet | tx_hash | created | expires |... │         │
│  └────────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

## Conclusion

The payment session flow now provides:
1. **Security**: Server-side validation prevents bypass
2. **UX**: Automatic modal opening on session expiration
3. **Clarity**: Clear error messages and visual feedback
4. **Recovery**: Easy path to pay and continue playing

Users who try to bypass payment will be caught at score submission and automatically prompted to pay, creating a smooth and secure experience.
