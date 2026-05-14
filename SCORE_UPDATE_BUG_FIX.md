# Score Update Bug Fix - URGENT

## Problem
When a player finished a game with a new best score (e.g., 11 XP when previous best was 4 XP):
- ✅ The UI updated correctly showing 11 XP
- ❌ The database remained at 4 XP (score was NOT saved)

## Root Cause Analysis

### The Logs Revealed the Issue:
```
DELETE /api/game-session 200 in 472ms  <- Session deleted by useGamePayment
POST /api/game-score 403 in 480ms      <- Score update REJECTED (no session!)
DELETE /api/game-session 200 in 170ms  <- Duplicate delete by MarioGameConsoleV2
```

### The Problem: Duplicate GAME_OVER Listeners

There were **TWO separate listeners** for the `GAME_OVER` postMessage event:

1. **`useGamePayment.ts` (Line 283-305)** 
   - Listening for GAME_OVER postMessage
   - Immediately deleting the session when received
   
2. **`MarioGameConsoleV2.tsx` (Line 181-208)**
   - Also listening for GAME_OVER postMessage
   - Trying to save score, THEN delete session

### The Race Condition:
```
Time: 0ms    → Game sends GAME_OVER postMessage
Time: 0ms    → Both listeners receive event simultaneously
Time: 472ms  → useGamePayment deletes session ❌
Time: 480ms  → MarioGameConsoleV2 tries to save score
             → API rejects: "No active game session" (403 Forbidden)
             → Score NOT saved to database ❌
```

The API **requires an active session** to accept score updates (security feature). By the time the score update request reached the server, the session was already deleted by the other listener.

## The Fix

### 1. Removed Duplicate Listener from `useGamePayment.ts`
**Before:**
```typescript
useEffect(() => {
  const handleGameOver = async (event: MessageEvent) => {
    if (event.data && event.data.type === 'GAME_OVER') {
      await fetch('/api/game-session', { method: 'DELETE' }); // ❌ Deletes too early!
      clearPaymentSession();
    }
  };
  window.addEventListener('message', handleGameOver);
}, []);
```

**After:**
```typescript
/**
 * NOTE: GAME_OVER session clearing is now handled in MarioGameConsoleV2
 * to ensure proper sequencing - score must be saved BEFORE session is cleared.
 * This prevents race conditions where the session gets deleted before the score
 * update API call completes (which requires an active session).
 */
// Listener removed - no longer needed here
```

### 2. Fixed Sequencing in `MarioGameConsoleV2.tsx`
**Before:**
```typescript
case 'GAME_OVER':
  updateScore(coins, true);           // Start async save
  clearPaymentSession();              // Delete immediately ❌
  fetch('/api/game-session', { method: 'DELETE' });
  break;
```

**After:**
```typescript
case 'GAME_OVER':
  if (coins > bestScore) {
    // Wait for score to save BEFORE clearing session
    updateScore(coins, true).then(() => {
      clearPaymentSession();          // ✅ Delete AFTER save
      fetch('/api/game-session', { method: 'DELETE' });
    }).catch(err => {
      // Still clear session even if save fails
      clearPaymentSession();
      fetch('/api/game-session', { method: 'DELETE' });
    });
  } else {
    // No score update needed, clear immediately
    clearPaymentSession();
    fetch('/api/game-session', { method: 'DELETE' });
  }
  break;
```

## Expected Logs After Fix
```
POST /api/game-score 200 in 450ms     <- Score saved successfully ✅
DELETE /api/game-session 200 in 470ms <- Session deleted AFTER save ✅
```

## Files Modified
1. ✅ `src/hooks/useGamePayment.ts` - **REMOVED** duplicate GAME_OVER listener
2. ✅ `src/components/MarioGameConsoleV2.tsx` - Fixed to wait for score save before session deletion

## Testing Checklist
- [ ] Play game and achieve new best score (e.g., 11 XP when previous was 4 XP)
- [ ] Lose the game (trigger GAME_OVER)
- [ ] Check UI - should show 11 XP ✅
- [ ] Check database - should now show 11 XP ✅
- [ ] Check logs - should see POST /api/game-score 200 (not 403) ✅
- [ ] Verify session is cleared after score is saved ✅

## Why This Happened
The duplicate listener was likely added during development when implementing the payment session management. The `useGamePayment` hook was designed to manage session lifecycle, but the game console component also needed to handle GAME_OVER for score updates. This created an unintended conflict where both tried to manage the same event.

## Security Note
The fix maintains all security requirements:
- Scores can only be submitted with an active game session ✅
- Session is cleared immediately after game ends ✅
- Session is cleared AFTER score is saved (proper sequencing) ✅
- No security vulnerabilities introduced ✅
