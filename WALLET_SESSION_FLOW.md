# Wallet Connection & Session Flow Diagrams

## 1. Initial Connection Flow

```
┌─────────────┐
│    User     │
└──────┬──────┘
       │
       │ 1. Clicks "Connect Wallet"
       ▼
┌─────────────────────────────────┐
│     RainbowKit Modal            │
│  (Select Wallet Extension)      │
└──────┬──────────────────────────┘
       │
       │ 2. Selects MetaMask/Rabby/etc
       ▼
┌─────────────────────────────────┐
│   Wallet Extension Popup        │
│   "Connect to Shellies?"        │
└──────┬──────────────────────────┘
       │
       │ 3. Approves connection
       ▼
┌─────────────────────────────────┐
│   wagmi: useAccount             │
│   isConnected = true            │
│   address = "0x..."             │
└──────┬──────────────────────────┘
       │
       │ 4. Triggers SIWE flow
       ▼
┌─────────────────────────────────┐
│   SIWE Message Generation       │
│   "Sign in to Shellies..."      │
└──────┬──────────────────────────┘
       │
       │ 5. User signs message
       ▼
┌─────────────────────────────────┐
│   NextAuth: Verify Signature    │
│   Create JWT Session            │
└──────┬──────────────────────────┘
       │
       │ 6. Session created
       ▼
┌─────────────────────────────────┐
│   localStorage:                 │
│   - recentConnectorId: "..."    │
│   - wagmi.store: {...}          │
│                                 │
│   Cookies:                      │
│   - next-auth.session-token     │
└──────┬──────────────────────────┘
       │
       │ 7. Redirect to portal
       ▼
┌─────────────────────────────────┐
│   Portal Page                   │
│   ✅ Fully Connected            │
└─────────────────────────────────┘
```

---

## 2. Auto-Reconnection Flow (Browser Restart)

```
┌─────────────┐
│    User     │
│ Reopens App │
└──────┬──────┘
       │
       │ 1. Page loads
       ▼
┌─────────────────────────────────┐
│   SessionProvider               │
│   Reads JWT from cookie         │
│   session.address = "0x..."     │
└──────┬──────────────────────────┘
       │
       │ 2. Session restored
       ▼
┌─────────────────────────────────┐
│   useWalletSync Hook            │
│   Detects: session exists       │
│   but wallet not connected      │
└──────┬──────────────────────────┘
       │
       │ 3. Reads localStorage
       ▼
┌─────────────────────────────────┐
│   localStorage:                 │
│   recentConnectorId = "metaMask"│
└──────┬──────────────────────────┘
       │
       │ 4. Attempts reconnection
       ▼
┌─────────────────────────────────┐
│   wagmi: connectAsync()         │
│   with stored connector         │
└──────┬──────────────────────────┘
       │
       │ 5. Wallet reconnects
       ▼
┌─────────────────────────────────┐
│   useAccount                    │
│   isConnected = true ✅         │
│   address = "0x..." ✅          │
└──────┬──────────────────────────┘
       │
       │ 6. Verify match
       ▼
┌─────────────────────────────────┐
│   useWalletSync                 │
│   session.address === address   │
│   isSynced = true ✅            │
└──────┬──────────────────────────┘
       │
       │ 7. User can access portal
       ▼
┌─────────────────────────────────┐
│   Portal Page                   │
│   ✅ Seamless Access            │
└─────────────────────────────────┘
```

---

## 3. Wallet Disconnection Flow

```
┌─────────────┐
│    User     │
│ In Portal   │
└──────┬──────┘
       │
       │ 1. Opens wallet extension
       │ 2. Clicks "Disconnect"
       ▼
┌─────────────────────────────────┐
│   Wallet Extension              │
│   Disconnects from site         │
└──────┬──────────────────────────┘
       │
       │ 3. Event fired
       ▼
┌─────────────────────────────────┐
│   wagmi: useAccount             │
│   isConnected = false ⚠️        │
│   address = undefined           │
└──────┬──────────────────────────┘
       │
       │ 4. Detected by monitor
       ▼
┌─────────────────────────────────┐
│   useAccountMonitor             │
│   Detects: session exists       │
│   but wallet disconnected       │
└──────┬──────────────────────────┘
       │
       │ 5. Cleanup triggered
       ▼
┌─────────────────────────────────┐
│   handleAccountSwitch()         │
│   - Clear React Query cache     │
│   - Clear localStorage data     │
│   - Broadcast event             │
│   - Sign out from NextAuth      │
└──────┬──────────────────────────┘
       │
       │ 6. Session cleared
       ▼
┌─────────────────────────────────┐
│   NextAuth: signOut()           │
│   Remove session cookie         │
└──────┬──────────────────────────┘
       │
       │ 7. Redirect to home
       ▼
┌─────────────────────────────────┐
│   Home Page                     │
│   Must reconnect to access      │
└─────────────────────────────────┘
```

---

## 4. Address Switch Flow

```
┌─────────────┐
│    User     │
│ In Portal   │
└──────┬──────┘
       │
       │ 1. Opens wallet extension
       │ 2. Switches to Account B
       ▼
┌─────────────────────────────────┐
│   Wallet Extension              │
│   Active account changed        │
│   0xAAA... → 0xBBB...          │
└──────┬──────────────────────────┘
       │
       │ 3. Event fired
       ▼
┌─────────────────────────────────┐
│   wagmi: useAccount             │
│   address = "0xBBB..." ⚠️       │
│   (different from session)      │
└──────┬──────────────────────────┘
       │
       │ 4. Detected by monitor
       ▼
┌─────────────────────────────────┐
│   useAccountMonitor             │
│   Compares:                     │
│   session.address = "0xAAA..."  │
│   current.address = "0xBBB..."  │
│   MISMATCH! ⚠️                  │
└──────┬──────────────────────────┘
       │
       │ 5. Cleanup triggered
       ▼
┌─────────────────────────────────┐
│   handleAccountSwitch()         │
│   - Clear all caches            │
│   - Clear localStorage          │
│   - Sign out                    │
└──────┬──────────────────────────┘
       │
       │ 6. Redirect to home
       ▼
┌─────────────────────────────────┐
│   Home Page                     │
│   "Please reconnect with        │
│    your new wallet address"     │
└─────────────────────────────────┘
```

---

## 5. AuthGuard Protection Flow

```
┌─────────────┐
│    User     │
│ Visits      │
│ /portal     │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────┐
│   AuthGuard Component           │
└──────┬──────────────────────────┘
       │
       │ Check 1: Session loading?
       ▼
    ┌──────┐
    │ Yes  │──────► Show Loading Spinner
    └──────┘
       │ No
       │
       │ Check 2: Session exists?
       ▼
    ┌──────┐
    │ No   │──────► Redirect to Home
    └──────┘
       │ Yes
       │
       │ Check 3: Wallet connected?
       ▼
    ┌──────┐
    │ No   │──────► Show "Reconnect Wallet" Warning
    └──────┘
       │ Yes
       │
       │ Check 4: Addresses match?
       ▼
    ┌──────┐
    │ No   │──────► Show "Address Mismatch" Warning
    └──────┘
       │ Yes
       │
       │ All checks passed ✅
       ▼
┌─────────────────────────────────┐
│   Render Protected Content      │
│   User can access portal        │
└─────────────────────────────────┘
```

---

## 6. State Synchronization Overview

```
┌────────────────────────────────────────────────────────────┐
│                    Browser State                           │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌──────────────────┐         ┌──────────────────┐       │
│  │  Wallet State    │         │  Session State   │       │
│  │  (wagmi)         │         │  (NextAuth)      │       │
│  ├──────────────────┤         ├──────────────────┤       │
│  │ isConnected      │         │ status           │       │
│  │ address          │         │ session.address  │       │
│  │ connector        │         │ session.chainId  │       │
│  └────────┬─────────┘         └────────┬─────────┘       │
│           │                            │                  │
│           │    ┌──────────────────┐    │                  │
│           └────┤  useWalletSync   ├────┘                  │
│                │  (Sync Logic)    │                       │
│                └────────┬─────────┘                       │
│                         │                                 │
│                         │ Ensures:                        │
│                         │ • Wallet reconnects if session  │
│                         │ • Addresses match               │
│                         │ • State is consistent           │
│                         │                                 │
│                ┌────────▼─────────┐                       │
│                │ useAccountMonitor│                       │
│                │ (Cleanup Logic)  │                       │
│                └────────┬─────────┘                       │
│                         │                                 │
│                         │ Handles:                        │
│                         │ • Disconnections                │
│                         │ • Address switches              │
│                         │ • Session cleanup               │
│                         │                                 │
└─────────────────────────┼─────────────────────────────────┘
                          │
                          ▼
                  ┌───────────────┐
                  │  localStorage │
                  ├───────────────┤
                  │ Connector ID  │
                  │ Wagmi Store   │
                  └───────────────┘
```

---

## 7. Component Hierarchy

```
App Root
│
├── WagmiProvider (wagmi config with storage)
│   │
│   ├── QueryClientProvider (React Query)
│   │   │
│   │   ├── SessionProvider (NextAuth with refetch)
│   │   │   │
│   │   │   ├── RainbowKitSiweNextAuthProvider (SIWE integration)
│   │   │   │   │
│   │   │   │   ├── RainbowKitProvider (UI components)
│   │   │   │   │   │
│   │   │   │   │   ├── AccountMonitorWrapper
│   │   │   │   │   │   │
│   │   │   │   │   │   ├── useAccountMonitor() ← Cleanup logic
│   │   │   │   │   │   └── useWalletSync() ← Sync logic
│   │   │   │   │   │
│   │   │   │   │   └── App Content
│   │   │   │   │       │
│   │   │   │   │       ├── Home Page
│   │   │   │   │       │   └── CustomConnectButton
│   │   │   │   │       │
│   │   │   │   │       └── Portal Layout
│   │   │   │   │           │
│   │   │   │   │           ├── AuthGuard ← Protection
│   │   │   │   │           │   │
│   │   │   │   │           │   └── useAccount() ← Check wallet
│   │   │   │   │           │   └── useSession() ← Check auth
│   │   │   │   │           │
│   │   │   │   │           └── Portal Pages
│   │   │   │   │               ├── Dashboard
│   │   │   │   │               ├── Raffles
│   │   │   │   │               ├── Staking
│   │   │   │   │               └── Profile
```

---

## 8. Data Storage Locations

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser Storage                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  localStorage                                               │
│  ├── recentConnectorId: "metaMask"                         │
│  ├── wagmi.store: { state: {...}, version: 2 }            │
│  └── wagmi.cache: { ... }                                  │
│                                                             │
│  Cookies                                                    │
│  ├── next-auth.session-token: "eyJhbGc..." (JWT)          │
│  ├── next-auth.csrf-token: "..."                          │
│  └── next-auth.callback-url: "..."                        │
│                                                             │
│  sessionStorage                                             │
│  └── (cleared on account switch)                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    Server Storage                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  JWT Token (in cookie)                                      │
│  ├── address: "0x..."                                       │
│  ├── chainId: 57073                                         │
│  ├── iat: 1699200000                                        │
│  └── exp: 1699286400                                        │
│                                                             │
│  Database (Supabase)                                        │
│  ├── users table                                            │
│  │   ├── wallet_address                                     │
│  │   ├── points                                             │
│  │   └── ...                                                │
│  └── sessions table (if using database sessions)           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 9. Error Handling Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Error Scenarios                          │
└─────────────────────────────────────────────────────────────┘

Scenario A: Auto-reconnection Fails
│
├─► useWalletSync attempts reconnection
│   └─► connectAsync() throws error
│       └─► Error logged to console
│           └─► User sees "Reconnect Wallet" prompt
│               └─► Manual reconnection available

Scenario B: Session Expired
│
├─► User tries to access portal
│   └─► getServerSession() returns null
│       └─► AuthGuard detects no session
│           └─► Redirect to home page
│               └─► Must reconnect

Scenario C: Network Error
│
├─► RPC call fails
│   └─► wagmi retries automatically
│       └─► If all retries fail
│           └─► Error shown to user
│               └─► "Check network connection"

Scenario D: Wallet Locked
│
├─► Auto-reconnection attempted
│   └─► Wallet extension returns error
│       └─► Error logged
│           └─► User sees prompt to unlock wallet
│               └─► Manual reconnection after unlock

Scenario E: Wrong Network
│
├─► User on Ethereum Mainnet
│   └─► RainbowKit detects chain mismatch
│       └─► Shows "Wrong Network" button
│           └─► User clicks to switch
│               └─► Wallet prompts network switch
```

---

## 10. Timeline Comparison

### Before Fix ❌
```
Time    Event
─────────────────────────────────────────────────────
0:00    User connects wallet, enters portal
0:05    User closes browser
        
Day 2
0:00    User reopens browser
0:01    Session restored ✅
0:01    Wallet NOT connected ❌
0:02    User clicks "Play Game"
0:02    ERROR: "Wallet not connected" ❌
0:03    User confused, must manually reconnect
```

### After Fix ✅
```
Time    Event
─────────────────────────────────────────────────────
0:00    User connects wallet, enters portal
0:05    User closes browser
        
Day 2
0:00    User reopens browser
0:01    Session restored ✅
0:01    useWalletSync detects session
0:02    Wallet auto-reconnects ✅
0:02    User clicks "Play Game"
0:02    Game loads successfully ✅
0:03    User happy, seamless experience
```

---

## Summary

These flows demonstrate how the wallet connection and session management system works together to provide a seamless user experience. The key improvements are:

1. **Automatic reconnection** when session exists
2. **Proper cleanup** when wallet disconnects
3. **Address mismatch detection** for security
4. **Clear error states** for better UX
5. **Persistent storage** for connection state

All flows are designed to be fail-safe, with clear error messages and recovery paths for users.
