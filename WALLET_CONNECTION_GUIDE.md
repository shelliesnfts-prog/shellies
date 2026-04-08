# Developer Guide: Wallet Connection & Session Management

## Quick Reference

### Key Hooks

```typescript
// 1. Check wallet connection status
import { useAccount } from 'wagmi';
const { address, isConnected, connector } = useAccount();

// 2. Check NextAuth session
import { useSession } from 'next-auth/react';
const { data: session, status } = useSession();

// 3. Check if wallet and session are synced
import { useWalletSync } from '@/hooks/useWalletSync';
const { isSynced, sessionAddress, walletAddress } = useWalletSync();
```

### When to Use Each Hook

| Hook | Use Case | Returns |
|------|----------|---------|
| `useAccount` | Check if wallet is connected | `{ address, isConnected, connector }` |
| `useSession` | Check if user is authenticated | `{ data: session, status }` |
| `useWalletSync` | Check if wallet matches session | `{ isSynced, sessionAddress, walletAddress }` |
| `useAccountMonitor` | Auto-cleanup on account changes | Used internally in providers |

---

## Common Patterns

### Pattern 1: Protect a Component

```typescript
'use client';

import { useAccount } from 'wagmi';
import { useSession } from 'next-auth/react';

export function ProtectedComponent() {
  const { address, isConnected } = useAccount();
  const { data: session, status } = useSession();

  // Loading state
  if (status === 'loading') {
    return <div>Loading...</div>;
  }

  // Not authenticated
  if (status === 'unauthenticated' || !session) {
    return <div>Please connect your wallet</div>;
  }

  // Wallet not connected (session exists but wallet disconnected)
  if (!isConnected || !address) {
    return <div>Please reconnect your wallet</div>;
  }

  // Address mismatch
  if (address.toLowerCase() !== session.address?.toLowerCase()) {
    return <div>Wallet address mismatch. Please sign out and reconnect.</div>;
  }

  // All good!
  return <div>Protected content for {address}</div>;
}
```

### Pattern 2: Conditional Rendering Based on Connection

```typescript
'use client';

import { useAccount } from 'wagmi';
import { useSession } from 'next-auth/react';
import { ConnectButton } from '@rainbow-me/rainbowkit';

export function ConditionalComponent() {
  const { isConnected } = useAccount();
  const { data: session } = useSession();

  const isFullyConnected = isConnected && session;

  return (
    <div>
      {isFullyConnected ? (
        <button onClick={handleAction}>Perform Action</button>
      ) : (
        <ConnectButton />
      )}
    </div>
  );
}
```

### Pattern 3: Perform Wallet Operation

```typescript
'use client';

import { useAccount, useWriteContract } from 'wagmi';
import { useSession } from 'next-auth/react';

export function TransactionComponent() {
  const { address, isConnected } = useAccount();
  const { data: session } = useSession();
  const { writeContract } = useWriteContract();

  const handleTransaction = async () => {
    // Always check both before operations
    if (!isConnected || !address) {
      alert('Please connect your wallet');
      return;
    }

    if (!session) {
      alert('Please sign in');
      return;
    }

    if (address.toLowerCase() !== session.address?.toLowerCase()) {
      alert('Wallet address mismatch');
      return;
    }

    // Safe to proceed
    try {
      await writeContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'yourFunction',
        args: [/* your args */],
      });
    } catch (error) {
      console.error('Transaction failed:', error);
    }
  };

  return <button onClick={handleTransaction}>Send Transaction</button>;
}
```

### Pattern 4: Display User Info

```typescript
'use client';

import { useAccount } from 'wagmi';
import { useSession } from 'next-auth/react';

export function UserInfo() {
  const { address, isConnected } = useAccount();
  const { data: session } = useSession();

  return (
    <div>
      <div>
        Wallet: {isConnected ? address : 'Not connected'}
      </div>
      <div>
        Session: {session ? session.address : 'Not authenticated'}
      </div>
      <div>
        Status: {
          isConnected && session && 
          address?.toLowerCase() === session.address?.toLowerCase()
            ? '✅ Synced'
            : '⚠️ Not synced'
        }
      </div>
    </div>
  );
}
```

---

## API Routes

### Pattern 1: Protect API Route

```typescript
// src/app/api/protected/route.ts
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  // Get session
  const session = await getServerSession(authOptions);

  // Check authentication
  if (!session || !session.address) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Get request body
  const body = await request.json();

  // Verify the address in request matches session
  if (body.address?.toLowerCase() !== session.address.toLowerCase()) {
    return NextResponse.json(
      { error: 'Address mismatch' },
      { status: 403 }
    );
  }

  // Proceed with operation
  return NextResponse.json({ success: true });
}
```

### Pattern 2: Get User Address in API

```typescript
// src/app/api/user-data/route.ts
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.address) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Use session.address for database queries
  const userData = await db.users.findOne({
    wallet_address: session.address.toLowerCase()
  });

  return Response.json(userData);
}
```

---

## Best Practices

### ✅ DO

1. **Always check both `isConnected` and `session`** before wallet operations
2. **Use lowercase** when comparing addresses: `address.toLowerCase()`
3. **Handle loading states** properly with `status === 'loading'`
4. **Show clear error messages** when wallet is not connected
5. **Use AuthGuard** for protected routes
6. **Log important events** for debugging
7. **Clear cache** when session changes (handled by useAccountMonitor)

### ❌ DON'T

1. **Don't assume wallet is connected** just because session exists
2. **Don't compare addresses** without lowercasing
3. **Don't skip loading states** - causes UI flicker
4. **Don't perform operations** without checking connection
5. **Don't store sensitive data** in localStorage
6. **Don't trust client-side checks** alone - always verify on server
7. **Don't forget to handle** wallet disconnection scenarios

---

## Troubleshooting

### Issue: "Wallet not connected" error despite being connected

**Check:**
```typescript
const { address, isConnected } = useAccount();
const { data: session } = useSession();

console.log('Wallet:', { address, isConnected });
console.log('Session:', session);
console.log('Match:', address?.toLowerCase() === session?.address?.toLowerCase());
```

**Common causes:**
- Session exists but wallet disconnected → Auto-reconnect should trigger
- Address mismatch → Sign out and reconnect
- Race condition → Add loading state

### Issue: Session persists but wallet doesn't reconnect

**Check:**
```typescript
// In browser console:
console.log('Connector ID:', localStorage.getItem('recentConnectorId'));
console.log('Wagmi Store:', localStorage.getItem('wagmi.store'));
```

**Solutions:**
- Ensure wallet extension is unlocked
- Check console for reconnection errors
- Verify WalletConnect project ID is valid
- Try manual reconnection

### Issue: Infinite redirect loop

**Check:**
```typescript
// In AuthGuard or protected component
useEffect(() => {
  console.log('Status:', status);
  console.log('Session:', session);
  console.log('Connected:', isConnected);
}, [status, session, isConnected]);
```

**Common causes:**
- Missing loading state check
- Incorrect redirect logic
- Session not loading properly

---

## Testing Checklist

When adding new features that use wallet connection:

- [ ] Test with wallet connected
- [ ] Test with wallet disconnected
- [ ] Test with session but no wallet
- [ ] Test with wallet but no session
- [ ] Test address mismatch scenario
- [ ] Test loading states
- [ ] Test error handling
- [ ] Test on different browsers
- [ ] Test with different wallet extensions
- [ ] Test session expiration

---

## Environment Variables

Required for wallet connection:

```env
# NextAuth
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3000

# WalletConnect
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your-project-id

# Optional: Adjust session duration
# Default is 24 hours, configured in src/lib/auth.ts
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         Browser                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐         ┌──────────────┐                 │
│  │   Wallet     │         │  NextAuth    │                 │
│  │  Extension   │◄────────┤   Session    │                 │
│  │  (MetaMask)  │         │   (JWT)      │                 │
│  └──────┬───────┘         └──────┬───────┘                 │
│         │                        │                          │
│         │                        │                          │
│  ┌──────▼────────────────────────▼───────┐                 │
│  │         WagmiProvider                  │                 │
│  │  ┌──────────────────────────────────┐ │                 │
│  │  │    useAccount (wallet state)     │ │                 │
│  │  └──────────────────────────────────┘ │                 │
│  │  ┌──────────────────────────────────┐ │                 │
│  │  │   useSession (auth state)        │ │                 │
│  │  └──────────────────────────────────┘ │                 │
│  │  ┌──────────────────────────────────┐ │                 │
│  │  │   useWalletSync (sync logic)     │ │                 │
│  │  └──────────────────────────────────┘ │                 │
│  │  ┌──────────────────────────────────┐ │                 │
│  │  │  useAccountMonitor (cleanup)     │ │                 │
│  │  └──────────────────────────────────┘ │                 │
│  └────────────────────────────────────────┘                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Connection**: User connects wallet → SIWE signature → NextAuth session created
2. **Persistence**: Connector ID stored in localStorage, session in JWT cookie
3. **Reconnection**: Page load → useWalletSync detects session → auto-reconnects wallet
4. **Monitoring**: useAccountMonitor watches for changes → clears session if mismatch
5. **Protection**: AuthGuard checks both states → shows appropriate UI

---

## Migration Guide

If you're adding wallet connection to a new component:

### Before (Incorrect)
```typescript
// ❌ Only checking session
export function MyComponent() {
  const { data: session } = useSession();
  
  if (!session) return <div>Not connected</div>;
  
  return <button onClick={doWalletOperation}>Send</button>;
}
```

### After (Correct)
```typescript
// ✅ Checking both session and wallet
export function MyComponent() {
  const { address, isConnected } = useAccount();
  const { data: session, status } = useSession();
  
  if (status === 'loading') return <div>Loading...</div>;
  if (!session || !isConnected || !address) {
    return <div>Please connect wallet</div>;
  }
  
  const handleOperation = () => {
    if (!isConnected || !address) {
      alert('Wallet not connected');
      return;
    }
    doWalletOperation();
  };
  
  return <button onClick={handleOperation}>Send</button>;
}
```

---

## Additional Resources

- [Wagmi Documentation](https://wagmi.sh/)
- [RainbowKit Documentation](https://www.rainbowkit.com/)
- [NextAuth.js Documentation](https://next-auth.js.org/)
- [SIWE Specification](https://eips.ethereum.org/EIPS/eip-4361)

---

## Support

For issues or questions:
1. Check console logs for errors
2. Review this guide for common patterns
3. Check `TESTING_WALLET_SESSION.md` for test cases
4. Review `WALLET_SESSION_SYNC_FIX.md` for implementation details
