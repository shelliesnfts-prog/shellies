# Payment Tier System - Complete Overview

## System Architecture

### Tier Determination Flow
```
User connects wallet
    ↓
Check if user has staked NFTs (StakingService.isStaker)
    ↓
Check if user has NFTs (NFTService.getNFTCount)
    ↓
Apply Priority Logic:
    - Has staked NFTs? → STAKER tier (80% discount)
    - Has NFTs only? → NFT_HOLDER tier (50% discount)
    - Neither? → REGULAR tier (0% discount)
    ↓
Fetch tier payment amount from database
    ↓
Display to user in game console
```

## Tier Specifications

| Tier | Icon | Requirement | Discount | Default Price |
|------|------|-------------|----------|---------------|
| Regular | 👤 | No NFTs, no staking | 0% | 0.00001 ETH |
| NFT Holder | 🎨 | At least 1 NFT | 50% | 0.000005 ETH |
| Staker | 🔒 | At least 1 staked NFT | 80% | 0.000002 ETH |

## Priority Rules

1. **Staker** always wins if user has any staked NFTs
2. **NFT Holder** applies if user has NFTs but no staked NFTs
3. **Regular** is the default fallback

### Example Scenarios

| User Has | Tier Assigned | Reason |
|----------|---------------|--------|
| 0 NFTs, 0 staked | Regular | No NFTs or staking |
| 5 NFTs, 0 staked | NFT Holder | Has NFTs but not staking |
| 0 NFTs, 3 staked | Staker | Has staked NFTs (highest priority) |
| 10 NFTs, 2 staked | Staker | Has both, staker wins |

## Technical Implementation

### Database Schema
```sql
CREATE TABLE payment_tiers (
  id SERIAL PRIMARY KEY,
  tier_name VARCHAR(50) NOT NULL UNIQUE,
  payment_amount_wei VARCHAR(100) NOT NULL,
  min_nfts INTEGER NOT NULL DEFAULT 0,      -- Not used for logic anymore
  max_nfts INTEGER,                          -- Not used for logic anymore
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### API Endpoint
**GET /api/payment-amount**

Checks user's staking and NFT status, returns appropriate tier.

Request: Requires authenticated session
Response:
```json
{
  "payment_amount_wei": "2000000000000",
  "tier": "staker",
  "tier_description": "Users with staked NFTs (80% discount)",
  "is_staker": true,
  "is_nft_holder": true,
  "nft_count": 5,
  "fallback": false
}
```

### Frontend Hook
**useGamePayment()**

Returns:
- `paymentTier`: 'regular' | 'nft_holder' | 'staker'
- `isStaker`: boolean
- `isNFTHolder`: boolean
- `nftCount`: number
- `requiredEth`: bigint (payment amount in wei)

## Admin Management

### Admin Panel Features
- View all 3 tiers with current pricing
- Update payment amount for each tier
- See discount percentages
- View tier requirements

### What Admins CANNOT Do
- Add new tiers (system is fixed at 3)
- Delete tiers (all 3 are permanent)
- Change tier priority logic
- Modify tier requirements

### What Admins CAN Do
- Update payment amounts (in ETH)
- View tier statistics
- Monitor contract balance
- Withdraw funds

## User Experience

### Game Console Display
When user opens the game:
1. System checks their tier automatically
2. Shows appropriate badge if they have discount:
   - Staker: Purple gradient with 🔒 icon
   - NFT Holder: Blue gradient with 🎨 icon
3. Displays payment amount with discount applied
4. Shows tier name and discount percentage

### Payment Flow
1. User clicks "Play Game"
2. System shows payment modal with their tier pricing
3. User confirms payment in wallet
4. Transaction confirms on blockchain
5. Game session created
6. User can play

## Benefits of New System

### For Users
- ✅ Clear requirements (just need 1 NFT or 1 stake)
- ✅ Easy to understand tier structure
- ✅ Visible discount badges
- ✅ Incentive to stake for maximum discount

### For Admins
- ✅ Simple tier management
- ✅ Easy to adjust pricing
- ✅ No complex NFT count ranges
- ✅ Clear priority rules

### For Developers
- ✅ Cleaner code
- ✅ Easier to maintain
- ✅ Better performance (simpler queries)
- ✅ More testable

## Integration Points

### Services Used
1. **StakingService** - Checks if user has staked NFTs
2. **NFTService** - Checks user's NFT count
3. **Supabase** - Stores tier configuration
4. **Wagmi** - Handles blockchain transactions

### Key Files
- `src/app/api/payment-amount/route.ts` - Tier determination logic
- `src/hooks/useGamePayment.ts` - Frontend payment state
- `src/components/MarioGameConsoleV2.tsx` - Game UI
- `src/app/admin/withdrawals/page.tsx` - Admin management
- `migrations/026_simplify_payment_tiers.sql` - Database setup

## Future Enhancements

Possible improvements:
- Add tier statistics dashboard
- Track tier usage analytics
- Add tier-based rewards
- Implement tier upgrade notifications
- Add tier history tracking

## Support & Maintenance

### Monitoring
- Check tier distribution in analytics
- Monitor payment success rates per tier
- Track discount usage

### Common Issues
1. **User not getting correct tier**: Check staking contract address in env
2. **Tier not updating**: Clear cache and refresh
3. **Payment amount wrong**: Verify tier amounts in database

### Updating Prices
To update tier pricing:
1. Go to Admin Panel → Withdrawals
2. Find the tier card
3. Click "Update" button
4. Enter new ETH amount
5. Confirm transaction
