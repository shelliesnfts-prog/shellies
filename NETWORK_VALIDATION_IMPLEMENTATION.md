# Network Validation Implementation for Ink Chain

## Overview
This document explains how network validation is implemented to prevent users from making payment transactions on the wrong blockchain network.

## Architecture

### Multi-Layer Validation

#### Layer 1: Real-time Network Monitoring (Component Level)
**File:** `src/components/MarioGameConsoleV2.tsx`

```typescript
// Monitor network changes - updates whenever user switches network in wallet
useEffect(() => {
  if (chain) {
    const wrongNetwork = chain.id !== inkChain.id;
    setIsWrongNetwork(wrongNetwork);
    
    if (wrongNetwork) {
      console.warn('Wrong network detected:', {
        currentChain: chain.name,
        currentChainId: chain.id,
        expectedChain: inkChain.name,
        expectedChainId: inkChain.id
      });
    } else {
      console.log('Correct network detected: Ink Chain');
    }
  } else {
    setIsWrongNetwork(false);
  }
}, [chain]);
```

**Behavior:**
- Monitors `chain` from `useAccount()` hook
- Updates `isWrongNetwork` state whenever user switches network in wallet
- Shows/hides warning banner automatically
- Runs on component mount and whenever network changes

#### Layer 2: UI Prevention (Component Level)
**File:** `src/components/MarioGameConsoleV2.tsx`

```typescript
// Handle payment initiation
const handlePaymentInitiation = async (action: 'start' | 'restart') => {
  console.log('🎮 Payment initiation requested:', {
    action,
    currentChain: chain?.name,
    currentChainId: chain?.id,
    expectedChainId: inkChain.id,
    isCorrectNetwork: chain?.id === inkChain.id
  });
  
  // Check if user is on the correct network
  if (chain?.id !== inkChain.id) {
    console.error('❌ Payment blocked at component level - wrong network');
    setIsWrongNetwork(true);
    setShowPaymentOverlay(true);
    setPaymentStatus('error');
    return; // BLOCKS PAYMENT
  }

  // Proceed with payment...
};
```

**Behavior:**
- Checks network BEFORE calling `initiatePayment()`
- Shows error overlay if wrong network
- Prevents payment flow from starting

#### Layer 3: Transaction Prevention (Hook Level)
**File:** `src/hooks/useGamePayment.ts`

```typescript
const initiatePayment = useCallback(async (): Promise<boolean> => {
  // Validate wallet connection
  if (!isConnected || !address) {
    setPaymentError('Please connect your wallet');
    return false;
  }
  
  // Validate network - CRITICAL: Must be on Ink Chain
  if (!chain || chain.id !== inkChain.id) {
    const currentChainName = chain?.name || 'Unknown Network';
    
    console.error('❌ PAYMENT BLOCKED - Wrong Network:', {
      currentChain: currentChainName,
      currentChainId: chain?.id,
      expectedChain: inkChain.name,
      expectedChainId: inkChain.id,
      message: 'User must switch to Ink Chain before payment'
    });
    
    setPaymentError(`Wrong network detected...`);
    setPaymentErrorCode(ERROR_CODES.WRONG_NETWORK);
    return false; // BLOCKS writeContract CALL
  }
  
  // Call writeContract only if on correct network
  writeContract({
    address: GAME_PAYMENT_CONTRACT.address,
    abi: GAME_PAYMENT_CONTRACT.abi,
    functionName: 'payToPlay',
    value: currentRequiredEth,
  });
  
  return true;
}, [isConnected, address, chain, requiredEth, writeContract]);
```

**Behavior:**
- Final validation before calling `writeContract()`
- Returns `false` and blocks transaction if wrong network
- Sets error state with clear message

## UI Components

### Wrong Network Warning Banner
Shows when `isWrongNetwork === true`:

```tsx
{isWrongNetwork && (
  <div className="rounded-xl border p-6 bg-red-900/20 border-red-700/50">
    <div className="flex items-start gap-4">
      <Shield className="w-6 h-6 text-red-600" />
      <div className="flex-1">
        <h3>Wrong Network Detected</h3>
        <p>
          You are currently on {chain?.name || 'Unknown Network'}. 
          Please switch to the Ink Chain network to play the game.
        </p>
        <button onClick={() => switchChain?.({ chainId: inkChain.id })}>
          Switch to Ink Chain
        </button>
      </div>
    </div>
  </div>
)}
```

### Payment Error Overlay
Shows when payment is attempted on wrong network:

```tsx
<PaymentLoadingOverlay
  isVisible={showPaymentOverlay}
  paymentStatus={paymentStatus}
  errorMessage={isWrongNetwork 
    ? `Wrong network detected. You are on ${chain?.name}. Please switch to Ink Chain.`
    : paymentError
  }
  retryButtonText={isWrongNetwork ? 'Switch to Ink Chain' : undefined}
  onRetry={isWrongNetwork 
    ? () => switchChain?.({ chainId: inkChain.id })
    : handleRetryPayment
  }
/>
```

## Wagmi Configuration

### Chain Restriction
**File:** `src/lib/wagmi.ts`

```typescript
const inkChain = defineChain({
  id: 57073,
  name: 'Ink',
  // ... chain config
});

export const getConfig = (): Config => {
  if (!_config) {
    _config = getDefaultConfig({
      appName: 'Shellies Raffles',
      projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID,
      chains: [inkChain], // ONLY Ink Chain
      transports: {
        [inkChain.id]: http(),
      },
      ssr: true,
    });
  }
  return _config;
};
```

**Behavior:**
- Wagmi config only includes Ink Chain
- Other chains show as "unsupported" in wallet UI
- Encourages users to switch to Ink Chain

## Testing Checklist

### Manual Testing Steps:

1. **Connect wallet on Ink Chain**
   - ✅ Should show no warning
   - ✅ Should allow payment

2. **Switch to different network (e.g., Ethereum Mainnet)**
   - ✅ Warning banner should appear immediately
   - ✅ Banner should show current network name
   - ✅ "Switch to Ink Chain" button should be visible

3. **Try to start game on wrong network**
   - ✅ Payment overlay should show error
   - ✅ Error message should mention wrong network
   - ✅ Button should say "Switch to Ink Chain"
   - ✅ Transaction should NOT be sent

4. **Click "Switch to Ink Chain" button**
   - ✅ Wallet should prompt to switch network
   - ✅ After switching, warning should disappear
   - ✅ Payment should be allowed

5. **Switch network during payment flow**
   - ✅ If switched away from Ink, payment should fail
   - ✅ Error should be shown

### Console Logs to Check:

**On correct network:**
```
✅ Correct network detected: Ink Chain
🎮 Payment initiation requested: { isCorrectNetwork: true }
✅ Network check passed at component level
✅ Network validation passed - Ink Chain detected
```

**On wrong network:**
```
⚠️ Wrong network detected: { currentChain: "Ethereum", currentChainId: 1 }
🎮 Payment initiation requested: { isCorrectNetwork: false }
❌ Payment blocked at component level - wrong network
❌ PAYMENT BLOCKED - Wrong Network: { message: 'User must switch to Ink Chain' }
```

## Key Points

1. **No automatic switching** - We don't automatically switch networks, user must do it manually
2. **Real-time monitoring** - Network changes are detected immediately via `useAccount().chain`
3. **Multiple validation layers** - Component + Hook level checks ensure no transaction slips through
4. **Clear user feedback** - Warning banner + error overlay with "Switch to Ink Chain" button
5. **Wagmi v2 compatible** - Uses `useAccount().chain` instead of deprecated `useNetwork()`

## Ink Chain Details

- **Chain ID:** 57073
- **Name:** Ink
- **RPC URLs:** 
  - https://rpc-gel.inkonchain.com
  - https://rpc-qnd.inkonchain.com
  - https://ink.drpc.org
- **Explorer:** https://explorer.inkonchain.com
