# Wallet Connection & Session Management Fix

## Problem Summary

The application had a critical issue where NextAuth sessions would persist across browser restarts, but the wallet connection state would not synchronize properly. This led to scenarios where:

1. **Session persists but wallet disconnects**: Users could access the portal with a valid session, but their wallet was not connected, causing "wallet not connected" errors during operations.
2. **No automatic reconnection**: When returning to the app with an active session, the wallet would not automatically reconnect.
3. **Address mismatch detection**: No proper handling when the connected wallet address differs from the session address.

## Root Causes

1. **Wagmi storage not configured**: The wagmi config wasn't using localStorage to persist wallet connection state
2. **No wallet sync mechanism**: No hook to synchronize wallet connection with NextAuth session state
3. **Insufficient session validation**: AuthGuard only checked NextAuth session, not wallet connection status
4. **Missing reconnection logic**: No automatic attempt to reconnect wallet when session exists

## Solutions Implemented

### 1. Enhanced Wagmi Configuration (`src/lib/wagmi.ts`)

**Changes:**
- Added `storage: window.localStorage` to wagmi config to persist wallet connection state
- This allows wagmi to remember the last connected wallet across page reloads

```typescript
storage: typeof window !== 'undefined' ? window.localStorage : undefined,
```

### 2. Improved Session Provider Configuration (`src/components/PrivyProviders.tsx`)

**Changes:**
- Added `refetchInterval: 5 * 60` (5 minutes) to SessionProvider
- Added `refetchOnWindowFocus: true` to keep session fresh
- Added `enabled: true` to RainbowKitSiweNextAuthProvider for explicit SIWE integration

### 3. New Wallet Sync Hook (`src/hooks/useWalletSync.ts`)

**Purpose:** Automatically synchronize wallet connection state with NextAuth session

**Features:**
- Detects when session exists but wallet is disconnected
- Attempts automatic wallet reconnection using the last used connector
- Stores connector ID in localStorage for reconnection
- Provides sync status information

**Key Logic:**
```typescript
// Case 1: Session exists but wallet disconnected → Auto-reconnect
if (sessionAddress && !isConnected && status === 'authenticated') {
  // Attempt to reconnect with last used connector
}

// Case 2: Addresses don't match → Log warning (handled by useAccountMonitor)
if (sessionAddress !== currentAddress) {
  // Warning logged, useAccountMonitor will handle cleanup
}
```

### 4. Enhanced AuthGuard (`src/components/AuthGuard.tsx`)

**Changes:**
- Now uses `useAccount` hook to check wallet connection status
- Detects three states:
  1. **Loading**: Session or wallet connecting
  2. **Unauthenticated**: No session → Redirect to home
  3. **Wallet Warning**: Session exists but wallet disconnected/mismatched → Show reconnect prompt

**New Features:**
- Shows warning screen when wallet is disconnected but session is active
- Displays address mismatch information when detected
- Provides "Sign Out & Go Home" option to clear invalid sessions

### 5. Improved Account Monitor (`src/hooks/useAccountMonitor.ts`)

**Changes:**
- Added 1-second initialization delay to allow wallet auto-reconnection
- Better handling of initialization state to prevent false positives
- More robust detection of wallet disconnection vs. page load

### 6. Enhanced NextAuth Configuration (`src/lib/auth.ts`)

**Changes:**
- Added `maxAge: 24 * 60 * 60` (24 hours) for session expiration
- Added `updateAge: 60 * 60` (1 hour) to refresh session tokens
- Added `events.signOut` callback for cleanup logging
- Enhanced JWT callback to handle token updates

## How It Works Now

### Scenario 1: User Returns with Active Session

1. Page loads → SessionProvider restores NextAuth session
2. `useWalletSync` detects session exists but wallet not connected
3. Hook attempts auto-reconnection using stored connector ID
4. If successful → User seamlessly enters portal
5. If failed → AuthGuard shows reconnect prompt

### Scenario 2: Wallet Disconnected During Session

1. User manually disconnects wallet in MetaMask/Rabby
2. `useAccountMonitor` detects disconnection
3. Session is cleared and user is redirected to home
4. Prevents "wallet not connected" errors

### Scenario 3: Wallet Address Switch

1. User switches account in wallet extension
2. `useAccountMonitor` detects address mismatch
3. Session is cleared, cache is purged
4. User must reconnect with new address

### Scenario 4: Fresh Connection

1. User connects wallet for first time
2. SIWE authentication flow completes
3. Session created with wallet address
4. Connector ID stored for future reconnection

## Testing Checklist

- [x] Fresh wallet connection creates session
- [x] Session persists across page reloads
- [x] Wallet auto-reconnects when session exists
- [x] Wallet disconnection clears session
- [x] Address switch clears session
- [x] AuthGuard shows proper warnings
- [x] No TypeScript errors
- [x] Proper error handling and logging

## Configuration Requirements

Ensure these environment variables are set:

```env
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your-project-id
```

## Browser Compatibility

The solution uses:
- `localStorage` for persistence (supported in all modern browsers)
- `setTimeout` for delayed reconnection (universal support)
- Standard React hooks (React 18+)

## Performance Considerations

- Auto-reconnection attempts only once per session load
- 1-second delay prevents race conditions
- Session refetch limited to 5-minute intervals
- Minimal localStorage usage (only connector ID)

## Future Improvements

1. Add retry logic for failed reconnections
2. Implement exponential backoff for reconnection attempts
3. Add user preference to disable auto-reconnection
4. Store multiple connector preferences for fallback
5. Add analytics for connection success/failure rates

## Troubleshooting

### Wallet Not Auto-Reconnecting

1. Check browser console for errors
2. Verify `recentConnectorId` exists in localStorage
3. Ensure wallet extension is unlocked
4. Try manual reconnection

### Session Expires Too Quickly

1. Increase `maxAge` in `src/lib/auth.ts`
2. Adjust `updateAge` for more frequent refreshes
3. Check `NEXTAUTH_SECRET` is set correctly

### Address Mismatch Warnings

1. This is expected behavior when switching accounts
2. User should sign out and reconnect with new address
3. Check `useAccountMonitor` logs for details

## Related Files

- `src/lib/wagmi.ts` - Wagmi configuration
- `src/lib/auth.ts` - NextAuth configuration
- `src/components/PrivyProviders.tsx` - Provider setup
- `src/components/AuthGuard.tsx` - Route protection
- `src/hooks/useAccountMonitor.ts` - Account change detection
- `src/hooks/useWalletSync.ts` - Wallet synchronization
