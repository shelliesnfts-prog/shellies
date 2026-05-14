# NFT Holder Pricing Implementation Plan (Database Approach)

## Overview
Implement separate payment amounts for regular users vs NFT holders using database/frontend logic instead of smart contract changes.

## Current State
- Single payment amount managed via contract
- Admin can update one payment amount
- NFT service exists with `getNFTCount()` method
- Game payment flow uses `payToPlay()` contract function
- Contract accepts any payment >= minimum amount

## Why Database Approach?
✅ No contract redeployment needed
✅ Keep existing funds in current contract
✅ More flexible - can change pricing anytime without gas costs
✅ Can add more pricing tiers easily (VIP, premium, etc.)
✅ Easier to implement, test, and maintain
✅ Business logic stays in application layer

## Implementation Steps

### 1. Database Schema Updates

Create a new table to store payment tier configuration:

```sql
-- Create payment_tiers table
CREATE TABLE payment_tiers (
  id SERIAL PRIMARY KEY,
  tier_name VARCHAR(50) NOT NULL UNIQUE,
  payment_amount_wei VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default tiers
INSERT INTO payment_tiers (tier_name, payment_amount_wei, description) VALUES
  ('regular', '10000000000000', 'Regular users without NFT'),
  ('nft_holder', '5000000000000', 'Users holding at least 1 NFT (50% discount)');

-- Create index for faster lookups
CREATE INDEX idx_payment_tiers_active ON payment_tiers(is_active);
```

### 2. API Endpoints

Create new API routes to manage payment tiers:

#### a) GET /api/payment-tiers
Fetch all active payment tiers

```typescript
// src/app/api/payment-tiers/route.ts
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('payment_tiers')
    .select('*')
    .eq('is_active', true)
    .order('tier_name');
  
  return NextResponse.json({ tiers: data });
}
```

#### b) PUT /api/payment-tiers/[tier]
Update payment amount for a specific tier (admin only)

```typescript
// src/app/api/payment-tiers/[tier]/route.ts
export async function PUT(request: Request, { params }: { params: { tier: string } }) {
  // Check admin authentication
  const session = await getServerSession(authOptions);
  if (!session?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { payment_amount_wei } = await request.json();
  
  const { data, error } = await supabaseAdmin
    .from('payment_tiers')
    .update({ 
      payment_amount_wei,
      updated_at: new Date().toISOString()
    })
    .eq('tier_name', params.tier)
    .select()
    .single();
  
  return NextResponse.json({ tier: data });
}
```

#### c) GET /api/payment-amount
Get payment amount for current user based on NFT ownership

```typescript
// src/app/api/payment-amount/route.ts
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.address) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Check NFT ownership
  const nftCount = await NFTService.getNFTCount(session.address);
  const isNFTHolder = nftCount > 0;
  
  // Get appropriate tier
  const tierName = isNFTHolder ? 'nft_holder' : 'regular';
  
  const { data, error } = await supabaseAdmin
    .from('payment_tiers')
    .select('*')
    .eq('tier_name', tierName)
    .eq('is_active', true)
    .single();
  
  return NextResponse.json({ 
    payment_amount_wei: data.payment_amount_wei,
    tier: tierName,
    is_nft_holder: isNFTHolder,
    nft_count: nftCount
  });
}
```

### 3. Admin Panel Updates (src/app/admin/withdrawals/page.tsx)

#### UI Changes:
- Fetch payment tiers from database instead of contract
- Split payment amount card into two sections:
  - Regular User Payment Amount
  - NFT Holder Payment Amount
- Add separate update functionality for each tier
- Display both amounts with USD conversion
- Show discount percentage

#### State Management:
```typescript
const [paymentTiers, setPaymentTiers] = useState<any[]>([]);
const [loadingTiers, setLoadingTiers] = useState(false);
const [selectedTier, setSelectedTier] = useState<string | null>(null);
const [newPaymentAmount, setNewPaymentAmount] = useState<bigint>(BigInt(0));

// Fetch payment tiers from database
useEffect(() => {
  const fetchTiers = async () => {
    setLoadingTiers(true);
    const response = await fetch('/api/payment-tiers');
    const { tiers } = await response.json();
    setPaymentTiers(tiers);
    setLoadingTiers(false);
  };
  fetchTiers();
}, []);

// Update tier amount
const handleUpdateTierAmount = async (tierName: string, amountWei: string) => {
  const response = await fetch(`/api/payment-tiers/${tierName}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payment_amount_wei: amountWei })
  });
  
  if (response.ok) {
    // Refresh tiers
    fetchTiers();
  }
};
```

### 4. Game Payment Hook Updates (src/hooks/useGamePayment.ts)

#### Add NFT Check and Dynamic Pricing:
```typescript
const [isNFTHolder, setIsNFTHolder] = useState<boolean>(false);
const [nftCount, setNftCount] = useState<number>(0);
const [paymentTier, setPaymentTier] = useState<string>('regular');

// Fetch payment amount based on user's NFT ownership
useEffect(() => {
  const fetchPaymentAmount = async () => {
    if (!address) return;
    
    try {
      // Fetch user-specific payment amount from API
      const response = await fetch('/api/payment-amount');
      const data = await response.json();
      
      setRequiredEth(BigInt(data.payment_amount_wei));
      setIsNFTHolder(data.is_nft_holder);
      setNftCount(data.nft_count);
      setPaymentTier(data.tier);
      
    } catch (error) {
      console.error('Error fetching payment amount:', error);
      // Fallback to contract amount
      if (contractPaymentAmount) {
        setRequiredEth(contractPaymentAmount);
      }
    }
  };
  
  fetchPaymentAmount();
}, [address, contractPaymentAmount]);
```

#### Update Payment Initiation (No Changes to Contract Call):
```typescript
// Call payToPlay with the appropriate amount (contract doesn't care about tier)
writeContract({
  address: GAME_PAYMENT_CONTRACT.address,
  abi: GAME_PAYMENT_CONTRACT.abi,
  functionName: 'payToPlay',
  value: requiredEth, // This is the tier-specific amount
});
```

#### Return NFT holder info:
```typescript
return {
  hasActivePayment,
  paymentLoading,
  paymentError,
  paymentErrorCode,
  canRetryPayment,
  ethPrice,
  requiredEth,
  initiatePayment,
  clearPaymentSession: clearSession,
  checkPaymentStatus: checkStatus,
  retryPayment,
  sessionCreating,
  sessionCreated,
  // New fields
  isNFTHolder,
  nftCount,
  paymentTier,
};
```

### 5. Server-Side Payment Validation

Update game session creation to validate payment amount:

```typescript
// src/app/api/game-session/route.ts
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const { transactionHash } = await request.json();
  
  // Get transaction details from blockchain
  const receipt = await publicClient.getTransactionReceipt({ hash: transactionHash });
  const paidAmount = receipt.value;
  
  // Check user's NFT ownership
  const nftCount = await NFTService.getNFTCount(session.address);
  const tierName = nftCount > 0 ? 'nft_holder' : 'regular';
  
  // Get expected payment amount for this tier
  const { data: tier } = await supabaseAdmin
    .from('payment_tiers')
    .select('payment_amount_wei')
    .eq('tier_name', tierName)
    .single();
  
  const expectedAmount = BigInt(tier.payment_amount_wei);
  
  // Validate payment amount (allow some tolerance for gas)
  if (paidAmount < expectedAmount) {
    return NextResponse.json({ 
      error: 'Insufficient payment amount for your tier' 
    }, { status: 400 });
  }
  
  // Create game session with tier info
  const { data: gameSession } = await supabaseAdmin
    .from('game_sessions')
    .insert({
      wallet_address: session.address,
      transaction_hash: transactionHash,
      payment_amount: paidAmount.toString(),
      payment_tier: tierName,
      nft_count: nftCount,
      created_at: new Date().toISOString()
    })
    .select()
    .single();
  
  return NextResponse.json({ session: gameSession });
}
```

### 6. UI/UX Enhancements

#### Payment Modal:
- Show NFT holder badge with discount percentage
- Display "NFT Holder Price" vs "Regular Price"
- Show savings amount for NFT holders
- Add visual indicator (icon, color) for discounted price

#### Game Console:
- Display appropriate price based on NFT ownership
- Show "🎉 NFT Holder Discount Applied!" message
- Display NFT count if holder
- Show potential savings

## Testing Checklist

- [ ] Create payment_tiers table in database
- [ ] Insert default tier values
- [ ] Test API endpoints (GET /api/payment-tiers, PUT /api/payment-tiers/[tier])
- [ ] Test GET /api/payment-amount returns correct tier for NFT holders
- [ ] Test GET /api/payment-amount returns correct tier for regular users
- [ ] Test admin can update both payment amounts via UI
- [ ] Test regular user (no NFTs) sees and pays regular amount
- [ ] Test NFT holder sees and pays discounted amount
- [ ] Test server-side validation accepts correct payment amounts
- [ ] Test server-side validation rejects insufficient payments
- [ ] Test UI displays correct amounts for both user types
- [ ] Test discount badge shows for NFT holders
- [ ] Test game session stores tier information correctly
- [ ] Test withdrawal still works correctly (unchanged)
- [ ] Test edge case: user acquires NFT between page load and payment

## Implementation Order

1. **Database Setup** (5 min)
   - Create payment_tiers table
   - Insert default values

2. **API Routes** (30 min)
   - Create /api/payment-tiers
   - Create /api/payment-tiers/[tier]
   - Create /api/payment-amount
   - Update /api/game-session validation

3. **Admin Panel** (45 min)
   - Update withdrawals page to fetch from DB
   - Add UI for both tier amounts
   - Add update functionality

4. **Payment Hook** (30 min)
   - Add NFT check
   - Fetch tier-specific amount
   - Return NFT holder status

5. **UI Enhancements** (30 min)
   - Update PaymentModal with discount badge
   - Update MarioGameConsoleV2 with NFT holder messaging
   - Add visual indicators

6. **Testing** (30 min)
   - Test all user flows
   - Verify validation works
   - Check edge cases

**Total Time: ~3 hours**

## Benefits

✅ **No Contract Changes** - Keep existing deployed contract
✅ **Flexible Pricing** - Change amounts anytime without gas costs
✅ **Scalable** - Easy to add more tiers (VIP, premium, etc.)
✅ **Better UX** - Can show personalized pricing immediately
✅ **Audit Trail** - Track which tier each user paid
✅ **A/B Testing** - Can experiment with different pricing
✅ **Incentivizes NFT Ownership** - Clear value proposition
✅ **Admin Control** - Full control over pricing tiers

## Future Enhancements

- Add more tiers (VIP for 5+ NFTs, etc.)
- Time-based pricing (happy hour discounts)
- Promotional codes
- Referral discounts
- Staking multipliers
- Dynamic pricing based on demand
