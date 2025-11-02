# Game Payment Security Implementation

## Overview

This document explains the security measures implemented to prevent users from bypassing the pay-to-play system.

## Security Vulnerabilities Addressed

### Previous Vulnerability
The original implementation stored payment verification only in client-side `sessionStorage`, which could be easily manipulated:
- Users could open DevTools and manually set `sessionStorage` values
- Users could modify React state to show the game without paying
- Users could submit scores without valid payment

### Current Solution
We now use **server-side session verification** with the following security layers:

## Security Layers

### 1. Server-Side Game Sessions (`shellies_raffle_game_sessions` table)

**Database Schema:**
```sql
CREATE TABLE shellies_raffle_game_sessions (
    id UUID PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    transaction_hash TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true
);
```

**Key Features:**
- Each payment creates a unique game session in the database
- Transaction hashes are unique (can't be reused)
- Sessions expire after 24 hours or when game ends
- Only active sessions allow gameplay

### 2. API Endpoint Protection

**`/api/game-session` (GET)**
- Verifies if user has an active game session
- Checks session expiration
- Returns session details only for authenticated users

**`/api/game-session` (POST)**
- Creates new game session after payment
- Validates transaction hash uniqueness
- Prevents transaction reuse
- TODO: Add blockchain verification

**`/api/game-session` (DELETE)**
- Ends game session on game over
- Deactivates all active sessions for wallet

**`/api/game-score` (POST)**
- **CRITICAL:** Verifies active game session before accepting scores
- Returns 403 Forbidden if no valid session exists
- Prevents score submission without payment

### 3. Client-Side Flow

```
1. User loads game page
   ↓
2. Client checks server for active session (GET /api/game-session)
   ↓
3a. If session exists → Show game
3b. If no session → Show payment modal
   ↓
4. User pays → Transaction confirmed
   ↓
5. Client creates server session (POST /api/game-session)
   ↓
6. Server validates transaction and creates session
   ↓
7. Game becomes playable
   ↓
8. User plays and submits score
   ↓
9. Server verifies active session before accepting score
   ↓
10. Game over → Client ends session (DELETE /api/game-session)
```

### 4. Defense Against Common Attacks

#### Attack: Manipulate sessionStorage
**Defense:** Server ignores client-side storage. All verification happens server-side.

#### Attack: Modify React state to show game
**Defense:** Game component loads, but score submission fails without valid server session.

#### Attack: Reuse old transaction hash
**Defense:** Transaction hashes are unique in database. Reuse attempt fails.

#### Attack: Submit scores without playing
**Defense:** Score API requires active game session. No session = 403 Forbidden.

#### Attack: Keep session alive indefinitely
**Defense:** Sessions expire after 24 hours automatically.

## Implementation Checklist

- [x] Create `shellies_raffle_game_sessions` database table
- [x] Add RLS policies for security
- [x] Create `/api/game-session` endpoints
- [x] Update `/api/game-score` to verify sessions
- [x] Update `useGamePayment` hook for server verification
- [x] Rename table to follow project naming convention
- [ ] Add blockchain transaction verification
- [ ] Add rate limiting to prevent spam
- [ ] Add monitoring/logging for suspicious activity

## Future Enhancements

### 1. Blockchain Transaction Verification
Currently, we trust the transaction hash provided by the client. In production, you should:
- Verify transaction exists on Ink blockchain
- Verify transaction is to the correct contract address
- Verify transaction amount matches required payment
- Verify transaction is from the user's wallet address

### 2. Rate Limiting
Add rate limiting to prevent:
- Spam session creation attempts
- Brute force attacks
- DDoS attempts

### 3. Monitoring & Alerts
Implement monitoring for:
- Failed session verification attempts
- Suspicious patterns (multiple failed payments)
- Score submissions without valid sessions
- Unusual transaction patterns

## Testing

### Manual Testing
1. Pay and verify game loads
2. Try to submit score without payment (should fail)
3. Try to reuse transaction hash (should fail)
4. Verify session expires after game over
5. Verify session expires after 24 hours

### Security Testing
1. Open DevTools and modify `sessionStorage` → Game should not accept scores
2. Modify React state to show game → Score submission should fail
3. Call `/api/game-score` directly without session → Should return 403
4. Try to create session with fake transaction hash → Should fail (once blockchain verification is added)

## Deployment Notes

1. **Run Migrations:**
   ```bash
   # Apply the database migrations
   supabase db push
   
   # This will apply:
   # - 20250102000000_create_game_sessions.sql (creates table)
   # - 20250102000001_rename_game_sessions_table.sql (renames to shellies_raffle_game_sessions)
   ```

2. **Environment Variables:**
   No new environment variables required.

3. **Monitoring:**
   Monitor the following metrics:
   - Session creation rate
   - Failed session verification attempts
   - Score submission success/failure rate

## Conclusion

This implementation provides strong protection against payment bypass exploits by:
- Moving verification to the server
- Validating every score submission
- Preventing transaction reuse
- Implementing proper session management

The system is now secure against common client-side manipulation attacks while maintaining a smooth user experience.
