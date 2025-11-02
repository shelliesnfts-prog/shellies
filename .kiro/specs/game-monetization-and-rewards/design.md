# Design Document

## Overview

This design document outlines the technical approach for adding two major features to the Shellies Game platform: a pay-to-play monetization system using a Solidity smart contract on Ink network, and an XP-to-points bridge that allows players to convert their game experience points into raffle entry points. The design integrates with the existing Next.js application, Supabase database, and wagmi wallet connectivity while introducing new blockchain interactions and animated UI components.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Game Portal Page                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │         Wallet Connected Check                        │  │
│  └───────────────────────────────────────────────────────┘  │
│                              │                               │
│                              ▼                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │         Payment Status Check                          │  │
│  │  - Check session storage for payment                  │  │
│  │  - Check game session state                           │  │
│  └───────────────────────────────────────────────────────┘  │
│                              │                               │
│              ┌───────────────┴───────────────┐              │
│              ▼                               ▼              │
│  ┌──────────────────────┐      ┌──────────────────────┐    │
│  │  PaymentModal        │      │  MarioGameConsoleV2  │    │
│  │  (Not Paid)          │      │  (Paid - Play)       │    │
│  └──────────────────────┘      └──────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│         Solidity Smart Contract (Ink Network)                │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  GamePaymentContract                                  │  │
│  │  - payToPlay() payable                                │  │
│  │  - withdraw() [owner only]                            │  │
│  │  - getBalance() view                                  │  │
│  │  - Events: PaymentReceived, FundsWithdrawn            │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Profile Page                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │         XP Bridge Component                           │  │
│  │  - Display XP balance (game_score)                    │  │
│  │  - Display points balance                             │  │
│  │  - Conversion input (1000 XP = 100 points)            │  │
│  │  - Convert button with animation                      │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Routes                                │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  POST /api/bridge/convert-xp                          │  │
│  │  - Validate XP balance                                │  │
│  │  - Calculate points (xp / 10)                         │  │
│  │  - Update game_score (subtract XP)                    │  │
│  │  - Update points (add calculated points)              │  │
│  │  - Return updated balances                            │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Supabase Database                           │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  shellies_raffle_users table                          │  │
│  │  - wallet_address (primary key)                       │  │
│  │  - game_score (integer) → displayed as "XP"           │  │
│  │  - points (decimal)                                   │  │
│  │  - updated_at                                         │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Solidity Smart Contract (GamePaymentContract)

**Location:** `contracts/GamePaymentContract.sol`

**Purpose:** Handle game entry payments and owner withdrawals on Ink network.

**Design:**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract GamePaymentContract {
    address public owner;
    uint256 public totalCollected;
    uint256 public constant PAYMENT_AMOUNT = 0.00001 ether; // Adjustable based on ETH price
    
    event PaymentReceived(address indexed player, uint256 amount, uint256 timestamp);
    event FundsWithdrawn(address indexed owner, uint256 amount, uint256 timestamp);
    event PaymentAmountUpdated(uint256 oldAmount, uint256 newAmount);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }
    
    constructor() {
        owner = msg.sender;
    }
    
    function payToPlay() external payable {
        require(msg.value >= PAYMENT_AMOUNT, "Insufficient payment amount");
        totalCollected += msg.value;
        emit PaymentReceived(msg.sender, msg.value, block.timestamp);
    }
    
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        
        (bool success, ) = owner.call{value: balance}("");
        require(success, "Withdrawal failed");
        
        emit FundsWithdrawn(owner, balance, block.timestamp);
    }
    
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
    
    function updatePaymentAmount(uint256 newAmount) external onlyOwner {
        emit PaymentAmountUpdated(PAYMENT_AMOUNT, newAmount);
        // Note: This would require making PAYMENT_AMOUNT non-constant
    }
}
```

**Key Features:**
1. **Owner Management:** Store owner address on deployment
2. **Payment Validation:** Verify payment amount meets minimum requirement
3. **Balance Tracking:** Maintain total collected funds
4. **Access Control:** Only owner can withdraw using onlyOwner modifier
5. **Event Emission:** Emit events for tracking and UI updates
6. **Flexible Payment:** Accept any amount >= required minimum

### 2. Payment Modal Component

**Location:** `src/components/PaymentModal.tsx`

**Purpose:** Display payment interface and handle transaction flow.

**Design:**

```typescript
interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess: () => void;
  requiredAmount: bigint; // in wei
  usdAmount: number; // 0.04
}

Component State:
- paymentStatus: 'idle' | 'pending' | 'confirming' | 'success' | 'error'
- transactionHash: string | null
- errorMessage: string | null

Hooks Used:
- useAccount() - wagmi hook for wallet connection
- useWriteContract() - wagmi hook for contract interaction
- useWaitForTransactionReceipt() - wagmi hook for tx confirmation
- useState() - local state management
```

**Key Features:**
1. **Price Display:** Show both USD (0.04) and ETH equivalent
2. **Transaction Flow:**
   - User clicks "Pay to Play"
   - Call contract's payToPlay function with ETH value
   - Request wallet signature via wagmi
   - Submit transaction to Ink network
   - Wait for transaction confirmation
   - Show pending state with spinner
   - Show success/error state
3. **Error Handling:** Display user-friendly error messages
4. **Session Storage:** Store payment confirmation on success

**Styling:**
- Modal overlay with backdrop blur
- Gradient purple/pink theme matching portal design
- Animated transitions using framer-motion
- Responsive design for mobile

### 3. useGamePayment Hook

**Location:** `src/hooks/useGamePayment.ts`

**Purpose:** Manage payment state and blockchain interactions.

**Design:**

```typescript
interface UseGamePaymentReturn {
  hasActivePayment: boolean;
  paymentLoading: boolean;
  paymentError: string | null;
  ethPrice: number | null;
  requiredEth: bigint;
  initiatePayment: () => Promise<boolean>;
  clearPaymentSession: () => void;
  checkPaymentStatus: () => boolean;
}
```

**Key Logic:**

1. **Session Management:**
   - Store payment timestamp in sessionStorage
   - Check if payment is still valid for current session
   - Clear on game over event

2. **Price Fetching:**
   - Fetch ETH/USD price from CoinGecko or similar API
   - Calculate required ETH for 0.04 USD
   - Cache price for 5 minutes
   - Fallback to default price if API fails

3. **Payment Execution:**
   - Use wagmi's useWriteContract to call payToPlay
   - Pass calculated ETH amount as value
   - Wait for transaction confirmation
   - Store confirmation in sessionStorage

4. **Event Listeners:**
   - Listen for GAME_OVER postMessage
   - Clear payment session on game over
   - Require new payment for next session

### 4. GamePaymentService

**Location:** `src/lib/game-payment-service.ts`

**Purpose:** Utility functions for contract interactions.

**Design:**

```typescript
import { parseEther, formatEther } from 'viem';

export const GAME_PAYMENT_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_GAME_PAYMENT_CONTRACT as `0x${string}`;

export const GAME_PAYMENT_ABI = [
  {
    inputs: [],
    name: 'payToPlay',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'withdraw',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getBalance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'player', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
      { indexed: false, name: 'timestamp', type: 'uint256' },
    ],
    name: 'PaymentReceived',
    type: 'event',
  },
] as const;

export class GamePaymentService {
  static calculateRequiredEth(usdAmount: number, ethPrice: number): bigint {
    const ethAmount = usdAmount / ethPrice;
    return parseEther(ethAmount.toString());
  }
  
  static formatEthAmount(wei: bigint): string {
    return formatEther(wei);
  }
}
```

### 5. XP Bridge Component

**Location:** `src/components/XPBridge.tsx`

**Purpose:** UI for converting XP to raffle points with animation.

**Design:**

```typescript
interface XPBridgeProps {
  currentXP: number;
  currentPoints: number;
  onConversionComplete: (newXP: number, newPoints: number) => void;
}

Component State:
- xpInput: string - user input for XP amount
- calculatedPoints: number - resulting points
- isConverting: boolean - animation in progress
- conversionError: string | null
- showAnimation: boolean

Constants:
- CONVERSION_RATE = 10 // 1000 XP = 100 points (divide by 10)
```

**Key Features:**

1. **Input Validation:**
   - Real-time calculation as user types
   - Validate sufficient XP balance
   - Show error for invalid amounts
   - Disable convert button if invalid

2. **Conversion Animation:**
   - Trigger on convert button click
   - Particle effect from XP container to points container
   - Use framer-motion for smooth transitions
   - Duration: 1.5 seconds
   - Disable interactions during animation

3. **API Integration:**
   - Call `/api/bridge/convert-xp` endpoint
   - Pass walletAddress and xpAmount
   - Handle success/error responses
   - Update local state on success

**Animation Design:**

```typescript
// Particle animation using framer-motion
const particles = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  startX: xpContainerRef.current.offsetLeft,
  startY: xpContainerRef.current.offsetTop,
  endX: pointsContainerRef.current.offsetLeft,
  endY: pointsContainerRef.current.offsetTop,
}));

// Animate each particle with staggered delay
particles.map((particle, i) => (
  <motion.div
    key={particle.id}
    initial={{ x: particle.startX, y: particle.startY, opacity: 1 }}
    animate={{ x: particle.endX, y: particle.endY, opacity: 0 }}
    transition={{
      duration: 1.5,
      delay: i * 0.05,
      ease: "easeInOut"
    }}
  />
));
```

**Styling:**
- Card-based layout with gradient background
- XP and Points displayed in separate containers
- Conversion rate prominently displayed
- Input field with validation styling
- Success message with checkmark animation

### 6. Admin Withdrawal Interface

**Location:** `src/app/admin/withdrawals/page.tsx`

**Purpose:** Allow owner to withdraw collected funds from contract.

**Design:**

```typescript
Component State:
- contractBalance: bigint - current balance in wei
- usdValue: number - USD equivalent
- withdrawing: boolean
- withdrawalSuccess: boolean
- transactionHash: string | null

Access Control:
- Check if connected wallet matches owner address
- Redirect non-owners to portal
- Use environment variable for owner address

Hooks Used:
- useAccount() - wagmi for wallet connection
- useReadContract() - wagmi for reading balance
- useWriteContract() - wagmi for withdraw function
- useWaitForTransactionReceipt() - wagmi for tx confirmation
```

**Key Features:**

1. **Balance Display:**
   - Fetch contract balance using useReadContract
   - Display in ETH and USD
   - Auto-refresh every 30 seconds

2. **Withdrawal Flow:**
   - Confirm withdrawal with modal
   - Execute withdraw() contract function
   - Show transaction status
   - Display success message with tx hash
   - Refresh balance after success

3. **Transaction History:**
   - Display recent withdrawals (optional)
   - Show date, amount, tx hash
   - Link to Ink network explorer

**Security:**
- Environment variable for owner address
- Client-side check (contract enforces on-chain)
- Clear error messages for unauthorized access

## Data Models

### Payment Session Storage

```typescript
interface PaymentSession {
  timestamp: number;
  transactionHash: string;
  amount: string; // in ETH
  walletAddress: string;
}

// Stored in sessionStorage as JSON
sessionStorage.setItem('gamePaymentSession', JSON.stringify(session));
```

### XP Conversion Request

```typescript
interface ConvertXPRequest {
  walletAddress: string;
  xpAmount: number;
}

interface ConvertXPResponse {
  success: boolean;
  newXP: number;
  newPoints: number;
  pointsAdded: number;
  error?: string;
}
```

### Database Schema Updates

No schema changes required. Existing `shellies_raffle_users` table already has:
- `game_score` (integer) - will be displayed as "XP" in frontend
- `points` (decimal) - raffle points
- `wallet_address` (text) - primary key

## API Routes

### POST /api/bridge/convert-xp

**Location:** `src/app/api/bridge/convert-xp/route.ts`

**Purpose:** Convert user's XP to raffle points.

**Request Body:**
```typescript
{
  walletAddress: string;
  xpAmount: number;
}
```

**Response:**
```typescript
{
  success: boolean;
  newXP: number;
  newPoints: number;
  pointsAdded: number;
  error?: string;
}
```

**Logic:**

1. **Validation:**
   - Verify walletAddress is provided
   - Verify xpAmount is positive integer
   - Verify xpAmount is multiple of 1000 (optional)

2. **Database Query:**
   - Fetch current user data
   - Verify user has sufficient game_score
   - Calculate points: `pointsAdded = xpAmount / 10`

3. **Transaction:**
   ```sql
   BEGIN;
   UPDATE shellies_raffle_users
   SET 
     game_score = game_score - xpAmount,
     points = points + (xpAmount / 10),
     updated_at = NOW()
   WHERE wallet_address = walletAddress
   AND game_score >= xpAmount;
   COMMIT;
   ```

4. **Response:**
   - Return updated balances
   - Return 400 if insufficient XP
   - Return 500 for database errors

**Error Handling:**
- Insufficient XP: 400 with message
- User not found: 404 with message
- Database error: 500 with generic message
- Invalid input: 400 with validation errors

## Smart Contract Integration

### Wagmi Configuration

**Already Configured:** Your project already has wagmi and RainbowKit set up.

**Additional Configuration:**

```typescript
// src/lib/contracts.ts
export const GAME_PAYMENT_CONTRACT = {
  address: process.env.NEXT_PUBLIC_GAME_PAYMENT_CONTRACT as `0x${string}`,
  abi: [
    {
      inputs: [],
      name: 'payToPlay',
      outputs: [],
      stateMutability: 'payable',
      type: 'function',
    },
    {
      inputs: [],
      name: 'withdraw',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function',
    },
    {
      inputs: [],
      name: 'getBalance',
      outputs: [{ name: '', type: 'uint256' }],
      stateMutability: 'view',
      type: 'function',
    },
    {
      inputs: [],
      name: 'owner',
      outputs: [{ name: '', type: 'address' }],
      stateMutability: 'view',
      type: 'function',
    },
  ] as const,
} as const;
```

**Ink Network Configuration:**

Ensure Ink network is added to your wagmi config:

```typescript
// In your wagmi config file
import { defineChain } from 'viem';

export const inkNetwork = defineChain({
  id: 57073, // Ink mainnet chain ID
  name: 'Ink',
  network: 'ink',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: ['https://rpc-gel.inkonchain.com'],
    },
    public: {
      http: ['https://rpc-gel.inkonchain.com'],
    },
  },
  blockExplorers: {
    default: { name: 'Ink Explorer', url: 'https://explorer.inkonchain.com' },
  },
});
```

## Price Oracle Integration

### CoinGecko API Integration

**Location:** `src/lib/price-oracle.ts`

**Purpose:** Fetch real-time ETH/USD price.

**Design:**

```typescript
interface PriceCache {
  price: number;
  timestamp: number;
}

export class PriceOracle {
  private static cache: PriceCache | null = null;
  private static CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private static FALLBACK_PRICE = 2500; // Default ETH price in USD

  static async getEthPrice(): Promise<number> {
    // Check cache
    if (this.cache && Date.now() - this.cache.timestamp < this.CACHE_DURATION) {
      return this.cache.price;
    }

    try {
      // Fetch from CoinGecko
      const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'
      );
      const data = await response.json();
      const price = data.ethereum.usd;

      // Update cache
      this.cache = { price, timestamp: Date.now() };
      return price;
    } catch (error) {
      console.error('Failed to fetch ETH price:', error);
      return this.FALLBACK_PRICE;
    }
  }

  static calculateRequiredEth(usdAmount: number, ethPrice: number): number {
    return usdAmount / ethPrice;
  }
}
```

**Usage:**
```typescript
const ethPrice = await PriceOracle.getEthPrice();
const requiredEth = PriceOracle.calculateRequiredEth(0.04, ethPrice);
const requiredWei = parseEther(requiredEth.toString());
```

## Frontend Terminology Updates

### XP Display Strategy

**Approach:** Update all user-facing text while keeping backend field names unchanged.

**Locations to Update:**

1. **Profile Page** (`src/app/portal/profile/page.tsx`):
   - Add XP display card
   - Show "XP" label instead of "Game Score"
   - Format: "1,250 XP"

2. **Game Page** (`src/app/portal/game/page.tsx`):
   - Update score display to "XP"
   - Show "XP earned" messages

3. **Leaderboard** (`src/app/portal/leaderboard/page.tsx`):
   - Column header: "XP" instead of "Score"
   - Sort by XP

4. **Components:**
   - Create utility function for formatting: `formatXP(score: number): string`
   - Example: `formatXP(1250)` → "1,250 XP"

**Implementation:**

```typescript
// src/lib/format-utils.ts
export function formatXP(score: number): string {
  return `${score.toLocaleString()} XP`;
}

export function formatPoints(points: number): string {
  return `${points.toLocaleString()} points`;
}
```

## Error Handling

### Payment Errors

**Scenarios:**

1. **Insufficient ETH Balance:**
   - Message: "Insufficient ETH balance. You need {required} ETH to play."
   - Action: Show link to buy ETH or bridge to Ink

2. **Transaction Failed:**
   - Message: "Transaction failed. Please try again."
   - Action: Allow retry

3. **User Rejected:**
   - Message: "Payment cancelled."
   - Action: Close modal

4. **Network Error:**
   - Message: "Network error. Please check your connection."
   - Action: Allow retry

5. **Wrong Network:**
   - Message: "Please switch to Ink network."
   - Action: Show network switch button

### Conversion Errors

**Scenarios:**

1. **Insufficient XP:**
   - Message: "You don't have enough XP. You have {current} XP but need {required} XP."
   - Action: Disable convert button

2. **Invalid Amount:**
   - Message: "Please enter a valid amount (minimum 1000 XP)."
   - Action: Show validation error

3. **Database Error:**
   - Message: "Conversion failed. Please try again later."
   - Action: Allow retry

4. **Network Error:**
   - Message: "Network error. Your XP was not converted."
   - Action: Allow retry

## Testing Strategy

### Smart Contract Tests

**Framework:** Hardhat with ethers.js

**Test Cases:**

1. **Deployment:**
   - Test contract deploys with correct owner
   - Test initial state is correct

2. **Payment:**
   - Test successful payment with correct amount
   - Test payment with excess amount (should succeed)
   - Test payment with insufficient amount (should fail)
   - Test payment event emission

3. **Withdrawal:**
   - Test owner can withdraw funds
   - Test non-owner cannot withdraw
   - Test withdrawal event emission
   - Test balance updates correctly

4. **Edge Cases:**
   - Test multiple payments
   - Test withdrawal with zero balance
   - Test concurrent transactions

### Frontend Integration Tests

**Framework:** Jest + React Testing Library

**Test Cases:**

1. **Payment Modal:**
   - Test modal opens/closes
   - Test price display updates
   - Test payment flow (mock wagmi)
   - Test error handling

2. **XP Bridge:**
   - Test input validation
   - Test calculation accuracy
   - Test animation triggers
   - Test API integration (mock)
   - Test error states

3. **useGamePayment Hook:**
   - Test session management
   - Test price fetching
   - Test payment status check
   - Test game over event handling

4. **Admin Withdrawal:**
   - Test balance display
   - Test withdrawal flow
   - Test access control

### Manual Testing Checklist

**Payment Flow:**
- [ ] Payment modal shows correct ETH amount
- [ ] Payment transaction succeeds on Ink network
- [ ] Game starts after payment
- [ ] Payment persists on page refresh
- [ ] New payment required after game over
- [ ] Error messages display correctly
- [ ] Network switch prompt works

**XP Bridge:**
- [ ] XP and points display correctly
- [ ] Input validation works
- [ ] Calculation is accurate (1000 XP = 100 points)
- [ ] Animation plays smoothly
- [ ] Balances update after conversion
- [ ] Error handling works

**Admin Withdrawal:**
- [ ] Only owner can access page
- [ ] Balance displays correctly in ETH
- [ ] Withdrawal succeeds
- [ ] Balance updates after withdrawal
- [ ] Transaction hash links to Ink explorer

**XP Terminology:**
- [ ] "XP" displays on profile page
- [ ] "XP" displays on game page
- [ ] "XP" displays on leaderboard
- [ ] No "score" or "game score" visible to users

## Performance Considerations

### 1. Price Caching

**Rationale:** Reduce API calls to price oracle

- Cache ETH price for 5 minutes
- Update cache on successful fetch
- Use fallback price if API fails

### 2. Session Storage

**Rationale:** Persist payment across page refreshes

- Store payment session in sessionStorage
- Check on component mount
- Clear on game over

### 3. Animation Performance

**Rationale:** Smooth 60fps animation

- Use CSS transforms for particle movement
- Limit particle count to 20
- Use requestAnimationFrame for updates
- Disable interactions during animation

### 4. Database Transaction

**Rationale:** Ensure data consistency

- Use single UPDATE query for conversion
- Atomic operation (subtract XP, add points)
- Rollback on error

## Security Considerations

### 1. Smart Contract Security

**Measures:**
- Owner-only withdrawal with onlyOwner modifier
- Payment amount validation
- Reentrancy protection (checks-effects-interactions pattern)
- Event emission for audit trail
- Use OpenZeppelin contracts for security best practices

### 2. Frontend Validation

**Measures:**
- Validate XP amount before API call
- Check wallet connection before payment
- Verify transaction confirmation
- Sanitize user inputs
- Check correct network (Ink)

### 3. API Security

**Measures:**
- Validate wallet address format
- Check user exists in database
- Use database transactions for atomicity
- Rate limiting on conversion endpoint

### 4. Session Management

**Measures:**
- Store payment session client-side only
- Clear session on game over
- Validate session timestamp
- No sensitive data in sessionStorage

## Deployment Considerations

### Smart Contract Deployment

**Steps:**

1. **Compile Contract:**
   ```bash
   npx hardhat compile
   ```

2. **Deploy to Ink Testnet:**
   ```bash
   npx hardhat run scripts/deploy.ts --network ink-testnet
   ```

3. **Test on Testnet:**
   - Test all functions
   - Verify events
   - Test with real wallets

4. **Deploy to Ink Mainnet:**
   ```bash
   npx hardhat run scripts/deploy.ts --network ink-mainnet
   ```

5. **Verify Contract:**
   ```bash
   npx hardhat verify --network ink-mainnet <CONTRACT_ADDRESS>
   ```

6. **Update Environment Variables:**
   ```env
   NEXT_PUBLIC_GAME_PAYMENT_CONTRACT=<contract_address>
   NEXT_PUBLIC_OWNER_WALLET=<owner_address>
   ```

### Frontend Deployment

**Environment Variables:**

```env
# Smart Contract Configuration
NEXT_PUBLIC_GAME_PAYMENT_CONTRACT=<contract_address>
NEXT_PUBLIC_OWNER_WALLET=<owner_address>

# Existing variables
NEXT_PUBLIC_SUPABASE_URL=<url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<key>
```

**Build and Deploy:**

```bash
npm run build
npm run start
```

### Database Migrations

No migrations required. Existing schema supports all features.

## Rollback Plan

### Smart Contract Rollback

**Not Possible:** Smart contracts are immutable once deployed.

**Mitigation:**
- Deploy new version with fixes
- Update contract address in environment variables
- Migrate funds from old contract to new (if needed)
- Keep old contract address for reference

### Frontend Rollback

**Steps:**

1. **Remove Payment Modal:**
   - Comment out payment check in game page
   - Allow free play temporarily

2. **Remove XP Bridge:**
   - Hide bridge component from profile
   - Keep API endpoint (no harm)

3. **Revert XP Terminology:**
   - Change "XP" back to "Score" if needed
   - Update formatXP utility

4. **Environment Variables:**
   - Remove contract-related variables
   - App continues to work without them

## Migration Path

### Phase 1: Smart Contract (Week 1)

1. Develop and test contract locally
2. Deploy to Ink testnet
3. Verify contract functions
4. Deploy to Ink mainnet

### Phase 2: Payment Integration (Week 2)

1. Implement payment modal
2. Create useGamePayment hook
3. Integrate with game page
4. Test payment flow on testnet
5. Test on mainnet

### Phase 3: XP Bridge (Week 2-3)

1. Update terminology to XP
2. Implement bridge component
3. Create API endpoint
4. Add to profile page
5. Test conversion flow

### Phase 4: Admin Interface (Week 3)

1. Create admin withdrawal page
2. Implement access control
3. Test withdrawal flow

### Phase 5: Testing & Launch (Week 4)

1. End-to-end testing
2. Security audit (recommended)
3. User acceptance testing
4. Production deployment

me
nt: boolean;
  paymentLoading: boolean;
  paymentError: string | null;
  solPrice: number | null;
  requiredSol: number;
  initiatePayment: () => Promise<boolean>;
  clearPaymentSession: () => void;
  checkPaymentStatus: () => boolean;
}
```

**Key Logic:**

1. **Session Management:**
   - Store payment timestamp in sessionStorage
   - Check if payment is still valid for current session
   - Clear on game over event

2. **Price Fetching:**
   - Fetch SOL/USD price from CoinGecko or similar API
   - Calculate required SOL for 0.04 USD
   - Cache price for 5 minutes
   - Fallback to default price if API fails

3. **Payment Execution:**
   - Build transaction with Solana web3.js
   - Request wallet signature
   - Submit and confirm transaction
   - Store confirmation in sessionStorage

4. **Event Listeners:**
   - Listen for GAME_OVER postMessage
   - Clear payment session on game over
   - Require new payment for next session

### 4. XP Bridge Component

**Location:** `src/components/XPBridge.tsx`

**Purpose:** UI for converting XP to raffle points with animation.

**Design:**

```typescript
interface XPBridgeProps {
  currentXP: number;
  currentPoints: number;
  onConversionComplete: (newXP: number, newPoints: number) => void;
}

Component State:
- xpInput: string - user input for XP amount
- calculatedPoints: number - resulting points
- isConverting: boolean - animation in progress
- conversionError: string | null
- showAnimation: boolean

Constants:
- CONVERSION_RATE = 10 // 1000 XP = 100 points (divide by 10)
```

**Key Features:**

1. **Input Validation:**
   - Real-time calculation as user types
   - Validate sufficient XP balance
   - Show error for invalid amounts
   - Disable convert button if invalid

2. **Conversion Animation:**
   - Trigger on convert button click
   - Particle effect from XP container to points container
   - Use framer-motion for smooth transitions
   - Duration: 1.5 seconds
   - Disable interactions during animation

3. **API Integration:**
   - Call `/api/bridge/convert-xp` endpoint
   - Pass walletAddress and xpAmount
   - Handle success/error responses
   - Update local state on success

**Animation Design:**

```typescript
// Particle animation using framer-motion
const particles = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  startX: xpContainerRef.current.offsetLeft,
  startY: xpContainerRef.current.offsetTop,
  endX: pointsContainerRef.current.offsetLeft,
  endY: pointsContainerRef.current.offsetTop,
}));

// Animate each particle with staggered delay
particles.map((particle, i) => (
  <motion.div
    key={particle.id}
    initial={{ x: particle.startX, y: particle.startY, opacity: 1 }}
    animate={{ x: particle.endX, y: particle.endY, opacity: 0 }}
    transition={{
      duration: 1.5,
      delay: i * 0.05,
      ease: "easeInOut"
    }}
  />
));
```

**Styling:**
- Card-based layout with gradient background
- XP and Points displayed in separate containers
- Conversion rate prominently displayed
- Input field with validation styling
- Success message with checkmark animation

### 5. Admin Withdrawal Interface

**Location:** `src/app/admin/withdrawals/page.tsx`

**Purpose:** Allow owner to withdraw collected funds from contract.

**Design:**

```typescript
Component State:
- contractBalance: number - current balance in SOL
- usdValue: number - USD equivalent
- withdrawing: boolean
- withdrawalSuccess: boolean
- transactionHash: string | null

Access Control:
- Check if connected wallet matches owner address
- Redirect non-owners to portal
- Use environment variable for owner address
```

**Key Features:**

1. **Balance Display:**
   - Fetch contract balance on mount
   - Display in SOL and USD
   - Auto-refresh every 30 seconds

2. **Withdrawal Flow:**
   - Confirm withdrawal with modal
   - Execute withdraw() contract method
   - Show transaction status
   - Display success message with tx hash
   - Refresh balance after success

3. **Transaction History:**
   - Display recent withdrawals (optional)
   - Show date, amount, tx hash
   - Link to Solana explorer

**Security:**
- Environment variable for owner address
- Client-side check (contract enforces on-chain)
- Clear error messages for unauthorized access

## Data Models

### Payment Session Storage

```typescript
interface PaymentSession {
  timestamp: number;
  transactionHash: string;
  amount: number;
  walletAddress: string;
}

// Stored in sessionStorage as JSON
sessionStorage.setItem('gamePaymentSession', JSON.stringify(session));
```

### XP Conversion Request

```typescript
interface ConvertXPRequest {
  walletAddress: string;
  xpAmount: number;
}

interface ConvertXPResponse {
  success: boolean;
  newXP: number;
  newPoints: number;
  pointsAdded: number;
  error?: string;
}
```

### Database Schema Updates

No schema changes required. Existing `shellies_raffle_users` table already has:
- `game_score` (integer) - will be displayed as "XP" in frontend
- `points` (decimal) - raffle points
- `wallet_address` (text) - primary key

## API Routes

### POST /api/bridge/convert-xp

**Location:** `src/app/api/bridge/convert-xp/route.ts`

**Purpose:** Convert user's XP to raffle points.

**Request Body:**
```typescript
{
  walletAddress: string;
  xpAmount: number;
}
```

**Response:**
```typescript
{
  success: boolean;
  newXP: number;
  newPoints: number;
  pointsAdded: number;
  error?: string;
}
```

**Logic:**

1. **Validation:**
   - Verify walletAddress is provided
   - Verify xpAmount is positive integer
   - Verify xpAmount is multiple of 1000 (optional)

2. **Database Query:**
   - Fetch current user data
   - Verify user has sufficient game_score
   - Calculate points: `pointsAdded = xpAmount / 10`

3. **Transaction:**
   ```sql
   BEGIN;
   UPDATE shellies_raffle_users
   SET 
     game_score = game_score - xpAmount,
     points = points + (xpAmount / 10),
     updated_at = NOW()
   WHERE wallet_address = walletAddress
   AND game_score >= xpAmount;
   COMMIT;
   ```

4. **Response:**
   - Return updated balances
   - Return 400 if insufficient XP
   - Return 500 for database errors

**Error Handling:**
- Insufficient XP: 400 with message
- User not found: 404 with message
- Database error: 500 with generic message
- Invalid input: 400 with validation errors

## Smart Contract Integration

### Solana Web3.js Setup

**Dependencies:**
```json
{
  "@solana/web3.js": "^1.87.0",
  "@solana/wallet-adapter-react": "^0.15.0",
  "@solana/wallet-adapter-wallets": "^0.19.0",
  "@project-serum/anchor": "^0.28.0"
}
```

**Configuration:**

```typescript
// src/lib/solana-config.ts
import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';

export const SOLANA_NETWORK = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet';
export const RPC_ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC || clusterApiUrl(SOLANA_NETWORK);
export const GAME_PAYMENT_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_GAME_PAYMENT_PROGRAM_ID!
);
export const OWNER_WALLET = new PublicKey(
  process.env.NEXT_PUBLIC_OWNER_WALLET!
);

export const connection = new Connection(RPC_ENDPOINT, 'confirmed');
```

### Wallet Adapter Integration

**Location:** `src/contexts/SolanaWalletProvider.tsx`

**Purpose:** Provide Solana wallet connectivity.

**Design:**

```typescript
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';

export function SolanaWalletProvider({ children }: { children: React.ReactNode }) {
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={RPC_ENDPOINT}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
```

**Integration Point:**
- Wrap app in `src/app/layout.tsx`
- Provide alongside existing wagmi provider
- Users can connect both EVM and Solana wallets

### Payment Transaction Flow

```typescript
// src/lib/game-payment-service.ts
import { Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { connection, GAME_PAYMENT_PROGRAM_ID } from './solana-config';

export class GamePaymentService {
  static async payToPlay(
    walletPublicKey: PublicKey,
    amountInSol: number
  ): Promise<string> {
    // 1. Create transaction
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: walletPublicKey,
        toPubkey: GAME_PAYMENT_PROGRAM_ID,
        lamports: amountInSol * LAMPORTS_PER_SOL,
      })
    );

    // 2. Get recent blockhash
    transaction.recentBlockhash = (
      await connection.getRecentBlockhash()
    ).blockhash;
    transaction.feePayer = walletPublicKey;

    // 3. Sign and send (wallet adapter handles signing)
    const signature = await wallet.sendTransaction(transaction, connection);

    // 4. Confirm transaction
    await connection.confirmTransaction(signature, 'confirmed');

    return signature;
  }

  static async getContractBalance(): Promise<number> {
    const balance = await connection.getBalance(GAME_PAYMENT_PROGRAM_ID);
    return balance / LAMPORTS_PER_SOL;
  }

  static async withdraw(ownerWallet: PublicKey): Promise<string> {
    // Call withdraw instruction on program
    // Implementation depends on Anchor IDL
  }
}
```

## Price Oracle Integration

### CoinGecko API Integration

**Location:** `src/lib/price-oracle.ts`

**Purpose:** Fetch real-time SOL/USD price.

**Design:**

```typescript
interface PriceCache {
  price: number;
  timestamp: number;
}

export class PriceOracle {
  private static cache: PriceCache | null = null;
  private static CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private static FALLBACK_PRICE = 20; // Default SOL price in USD

  static async getSolPrice(): Promise<number> {
    // Check cache
    if (this.cache && Date.now() - this.cache.timestamp < this.CACHE_DURATION) {
      return this.cache.price;
    }

    try {
      // Fetch from CoinGecko
      const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'
      );
      const data = await response.json();
      const price = data.solana.usd;

      // Update cache
      this.cache = { price, timestamp: Date.now() };
      return price;
    } catch (error) {
      console.error('Failed to fetch SOL price:', error);
      return this.FALLBACK_PRICE;
    }
  }

  static calculateRequiredSol(usdAmount: number, solPrice: number): number {
    return usdAmount / solPrice;
  }
}
```

**Usage:**
```typescript
const solPrice = await PriceOracle.getSolPrice();
const requiredSol = PriceOracle.calculateRequiredSol(0.04, solPrice);
```

## Frontend Terminology Updates

### XP Display Strategy

**Approach:** Update all user-facing text while keeping backend field names unchanged.

**Locations to Update:**

1. **Profile Page** (`src/app/portal/profile/page.tsx`):
   - Add XP display card
   - Show "XP" label instead of "Game Score"
   - Format: "1,250 XP"

2. **Game Page** (`src/app/portal/game/page.tsx`):
   - Update score display to "XP"
   - Show "XP earned" messages

3. **Leaderboard** (`src/app/portal/leaderboard/page.tsx`):
   - Column header: "XP" instead of "Score"
   - Sort by XP

4. **Components:**
   - Create utility function for formatting: `formatXP(score: number): string`
   - Example: `formatXP(1250)` → "1,250 XP"

**Implementation:**

```typescript
// src/lib/format-utils.ts
export function formatXP(score: number): string {
  return `${score.toLocaleString()} XP`;
}

export function formatPoints(points: number): string {
  return `${points.toLocaleString()} points`;
}
```

## Error Handling

### Payment Errors

**Scenarios:**

1. **Insufficient SOL Balance:**
   - Message: "Insufficient SOL balance. You need {required} SOL to play."
   - Action: Show link to buy SOL

2. **Transaction Failed:**
   - Message: "Transaction failed. Please try again."
   - Action: Allow retry

3. **User Rejected:**
   - Message: "Payment cancelled."
   - Action: Close modal

4. **Network Error:**
   - Message: "Network error. Please check your connection."
   - Action: Allow retry

### Conversion Errors

**Scenarios:**

1. **Insufficient XP:**
   - Message: "You don't have enough XP. You have {current} XP but need {required} XP."
   - Action: Disable convert button

2. **Invalid Amount:**
   - Message: "Please enter a valid amount (minimum 1000 XP)."
   - Action: Show validation error

3. **Database Error:**
   - Message: "Conversion failed. Please try again later."
   - Action: Allow retry

4. **Network Error:**
   - Message: "Network error. Your XP was not converted."
   - Action: Allow retry

## Testing Strategy

### Smart Contract Tests

**Framework:** Anchor test framework

**Test Cases:**

1. **Initialization:**
   - Test contract initializes with correct owner
   - Test state account created correctly

2. **Payment:**
   - Test successful payment with correct amount
   - Test payment rejection with incorrect amount
   - Test payment event emission

3. **Withdrawal:**
   - Test owner can withdraw funds
   - Test non-owner cannot withdraw
   - Test withdrawal event emission
   - Test balance updates correctly

4. **Edge Cases:**
   - Test multiple payments
   - Test withdrawal with zero balance
   - Test concurrent transactions

### Frontend Integration Tests

**Framework:** Jest + React Testing Library

**Test Cases:**

1. **Payment Modal:**
   - Test modal opens/closes
   - Test price display updates
   - Test payment flow (mock wallet)
   - Test error handling

2. **XP Bridge:**
   - Test input validation
   - Test calculation accuracy
   - Test animation triggers
   - Test API integration (mock)
   - Test error states

3. **useGamePayment Hook:**
   - Test session management
   - Test price fetching
   - Test payment status check
   - Test game over event handling

4. **Admin Withdrawal:**
   - Test balance display
   - Test withdrawal flow
   - Test access control

### Manual Testing Checklist

**Payment Flow:**
- [ ] Payment modal shows correct SOL amount
- [ ] Payment transaction succeeds
- [ ] Game starts after payment
- [ ] Payment persists on page refresh
- [ ] New payment required after game over
- [ ] Error messages display correctly

**XP Bridge:**
- [ ] XP and points display correctly
- [ ] Input validation works
- [ ] Calculation is accurate (1000 XP = 100 points)
- [ ] Animation plays smoothly
- [ ] Balances update after conversion
- [ ] Error handling works

**Admin Withdrawal:**
- [ ] Only owner can access page
- [ ] Balance displays correctly
- [ ] Withdrawal succeeds
- [ ] Balance updates after withdrawal
- [ ] Transaction hash links to explorer

**XP Terminology:**
- [ ] "XP" displays on profile page
- [ ] "XP" displays on game page
- [ ] "XP" displays on leaderboard
- [ ] No "score" or "game score" visible to users

## Performance Considerations

### 1. Price Caching

**Rationale:** Reduce API calls to price oracle

- Cache SOL price for 5 minutes
- Update cache on successful fetch
- Use fallback price if API fails

### 2. Session Storage

**Rationale:** Persist payment across page refreshes

- Store payment session in sessionStorage
- Check on component mount
- Clear on game over

### 3. Animation Performance

**Rationale:** Smooth 60fps animation

- Use CSS transforms for particle movement
- Limit particle count to 20
- Use requestAnimationFrame for updates
- Disable interactions during animation

### 4. Database Transaction

**Rationale:** Ensure data consistency

- Use single UPDATE query for conversion
- Atomic operation (subtract XP, add points)
- Rollback on error

## Security Considerations

### 1. Smart Contract Security

**Measures:**
- Owner-only withdrawal with on-chain verification
- Payment amount validation
- Reentrancy protection (Solana's account model)
- Event emission for audit trail

### 2. Frontend Validation

**Measures:**
- Validate XP amount before API call
- Check wallet connection before payment
- Verify transaction confirmation
- Sanitize user inputs

### 3. API Security

**Measures:**
- Validate wallet address format
- Check user exists in database
- Use database transactions for atomicity
- Rate limiting on conversion endpoint

### 4. Session Management

**Measures:**
- Store payment session client-side only
- Clear session on game over
- Validate session timestamp
- No sensitive data in sessionStorage

## Deployment Considerations

### Smart Contract Deployment

**Steps:**

1. **Deploy to Devnet:**
   ```bash
   anchor build
   anchor deploy --provider.cluster devnet
   ```

2. **Test on Devnet:**
   - Test all functions
   - Verify events
   - Test with real wallets

3. **Deploy to Mainnet:**
   ```bash
   anchor deploy --provider.cluster mainnet
   ```

4. **Update Environment Variables:**
   ```env
   NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
   NEXT_PUBLIC_GAME_PAYMENT_PROGRAM_ID=<program_id>
   NEXT_PUBLIC_OWNER_WALLET=<owner_pubkey>
   ```

### Frontend Deployment

**Environment Variables:**

```env
# Solana Configuration
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
NEXT_PUBLIC_SOLANA_RPC=https://api.mainnet-beta.solana.com
NEXT_PUBLIC_GAME_PAYMENT_PROGRAM_ID=<program_id>
NEXT_PUBLIC_OWNER_WALLET=<owner_pubkey>

# Existing variables
NEXT_PUBLIC_SUPABASE_URL=<url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<key>
```

**Build and Deploy:**

```bash
npm run build
npm run start
```

### Database Migrations

No migrations required. Existing schema supports all features.

## Rollback Plan

### Smart Contract Rollback

**Not Possible:** Smart contracts are immutable once deployed.

**Mitigation:**
- Deploy new version with fixes
- Update program ID in environment variables
- Migrate funds from old contract to new (if needed)

### Frontend Rollback

**Steps:**

1. **Remove Payment Modal:**
   - Comment out payment check in game page
   - Allow free play temporarily

2. **Remove XP Bridge:**
   - Hide bridge component from profile
   - Keep API endpoint (no harm)

3. **Revert XP Terminology:**
   - Change "XP" back to "Score" if needed
   - Update formatXP utility

4. **Environment Variables:**
   - Remove Solana-related variables
   - App continues to work without them

## Migration Path

### Phase 1: Smart Contract (Week 1)

1. Develop and test contract on devnet
2. Deploy to mainnet
3. Verify contract functions

### Phase 2: Payment Integration (Week 2)

1. Add Solana wallet provider
2. Implement payment modal
3. Integrate with game page
4. Test payment flow

### Phase 3: XP Bridge (Week 2-3)

1. Update terminology to XP
2. Implement bridge component
3. Create API endpoint
4. Add to profile page
5. Test conversion flow

### Phase 4: Admin Interface (Week 3)

1. Create admin withdrawal page
2. Implement access control
3. Test withdrawal flow

### Phase 5: Testing & Launch (Week 4)

1. End-to-end testing
2. Security audit
3. User acceptance testing
4. Production deployment

