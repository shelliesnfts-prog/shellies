# Account Switching Session Management Implementation

## Overview
This implementation ensures proper session cleanup when users switch wallet accounts in their browser extension (Metamask, Rabby, etc.) to prevent stale data and authentication issues.

## Key Components

### 1. Account Monitor Hook (`src/hooks/useAccountMonitor.ts`)
- Monitors wallet account changes using wagmi's `useAccount` hook
- Detects mismatches between session address and current wallet address
- Automatically triggers session cleanup when account switches are detected
- Clears React Query cache, localStorage, and sessionStorage
- Signs out user and broadcasts account switch events

### 2. Updated Points Context (`src/contexts/PointsContext.tsx`)
- Listens for `accountSwitched` events
- Immediately clears all user state (points, claim status, etc.)
- Resets internal refs to force fresh data fetching
- Prevents stale data from persisting across account switches

### 3. Enhanced Web3 Providers (`src/components/PrivyProviders.tsx`)
- Integrates account monitoring into the provider tree
- Ensures the monitor runs for all components using Web3 functionality
- Wraps children with `AccountMonitorWrapper` component

## How It Works

### Detection Scenarios
1. **Wallet account switched while authenticated**: Current wallet address differs from session address
2. **Wallet disconnected**: Session exists but wallet is no longer connected
3. **Address mismatch**: Session and wallet addresses don't match

### Cleanup Process
1. **Cache Clearing**: Removes all React Query cache to prevent stale API responses
2. **Storage Cleanup**: Clears relevant localStorage and sessionStorage entries
3. **Event Broadcasting**: Dispatches `accountSwitched` event for component coordination
4. **Session Termination**: Calls NextAuth `signOut()` to invalidate JWT session
5. **State Reset**: All user-related state is immediately cleared

### Fallback Mechanism
If cleanup fails, the system falls back to a page reload to ensure clean state.

## Benefits

- **Automatic Detection**: No manual intervention required
- **Complete Cleanup**: Removes all traces of previous account data
- **Immediate Response**: Changes take effect instantly upon account switch
- **Security**: Prevents unauthorized access to previous account's data
- **User Experience**: Seamless transition between accounts

## Usage

The implementation is automatically active once deployed. Users can:
1. Connect wallet and authenticate
2. Switch accounts in their wallet extension
3. The app automatically detects the switch and clears the session
4. Users are prompted to re-authenticate with the new account

## Technical Notes

- Uses React refs to track address changes and prevent infinite loops
- Leverages custom events for cross-component communication
- Maintains compatibility with existing authentication flow
- No breaking changes to existing codebase