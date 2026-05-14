# Payment Tier Simplification - Implementation Summary

## Overview
Simplified the payment tier system from a dynamic NFT-count-based system to 3 static tiers with clear priority rules.

## New Tier System

### 3 Static Tiers
1. **Regular** - Users without NFTs or staking (0% discount)
2. **NFT Holder** - Users with at least 1 NFT (50% discount)
3. **Staker** - Users with at least 1 staked NFT (80% discount)

### Priority Rules
- **Staker** has highest priority
- If a user has both NFTs and staked NFTs → Gets **Staker** tier
- If a user has only NFTs (not staked) → Gets **NFT Holder** tier
- If a user has neither → Gets **Regular** tier

### Key Simplifications
- No more NFT count ranges (1-4, 5-9, 10+)
- Just need 1 NFT or 1 staked NFT to unlock the tier
- Admins can only update payment amounts, not add/delete tiers
- Clearer and easier to understand for users

## Files Modified

### 1. Database Migration
**File:** `migrations/026_simplify_payment_tiers.sql`
- Deletes old dynamic tiers (bronze, silver, gold)
- Keeps/updates 3 static tiers: regular, nft_holder, staker
- Removes NFT range constraints (min_nfts, max_nfts no longer used for logic)

### 2. API Route - Payment Amount
**File:** `src/app/api/payment-amount/route.ts`
- Added `StakingService` import
- Checks both staking status AND NFT ownership in parallel
- Implements priority logic: Staker > NFT Holder > Regular
- Returns `is_staker` flag in response

### 3. Hook - Game Payment
**File:** `src/hooks/useGamePayment.ts`
- Added `isStaker` state
- Updated `UseGamePaymentReturn` interface to include `isStaker`
- Fetches and stores staker status from API
- Updated all places that set tier state to include staker status

### 4. Admin Panel - Withdrawals Page
**File:** `src/app/admin/withdrawals/page.tsx`
- Updated tier display to show only 3 static tiers
- Changed tier icons and colors:
  - Regular: 👤 (gray)
  - NFT Holder: 🎨 (blue)
  - Staker: 🔒 (purple)
- Removed "Add Tier" button and modal
- Removed "Delete Tier" functionality
- Removed "Activate/Deactivate" buttons (tiers are always active)
- Added info box explaining tier priority
- Updated tier descriptions to show requirements clearly

### 5. Game Console Component
**File:** `src/components/MarioGameConsoleV2.tsx`
- Added `isStaker` from `useGamePayment` hook
- Updated tier badge display logic
- Shows appropriate badge for Staker or NFT Holder
- Updated badge colors and icons to match new tier system
- Staker badge: 🔒 with purple gradient (80% OFF)
- NFT Holder badge: 🎨 with blue gradient (50% OFF)

## How to Deploy

### Step 1: Run Migration
```sql
-- In Supabase SQL Editor, run:
-- migrations/026_simplify_payment_tiers.sql
```

This will:
- Delete old tiers (bronze, silver, gold)
- Keep/update regular tier
- Add nft_holder tier (50% discount)
- Add staker tier (80% discount)

### Step 2: Verify Tiers
```sql
SELECT * FROM payment_tiers ORDER BY tier_name;
```

You should see exactly 3 tiers:
- regular: 10000000000000 wei (0.00001 ETH)
- nft_holder: 5000000000000 wei (0.000005 ETH)
- staker: 2000000000000 wei (0.000002 ETH)

### Step 3: Deploy Code
Deploy the updated code to production. The changes are backward compatible.

## Testing Checklist

- [ ] Migration runs successfully in Supabase
- [ ] Only 3 tiers exist in database (regular, nft_holder, staker)
- [ ] Admin panel shows 3 tier cards correctly
- [ ] Admin can update payment amounts for each tier
- [ ] Regular user (no NFTs, no staking) sees regular tier pricing
- [ ] NFT holder (has NFTs, no staking) sees nft_holder tier pricing
- [ ] Staker (has staked NFTs) sees staker tier pricing
- [ ] User with both NFTs and staked NFTs gets staker tier (highest priority)
- [ ] Game console shows correct tier badge
- [ ] Payment flow works correctly for all 3 tiers

## Benefits

1. **Simpler for Users**: Clear requirements - just need 1 NFT or 1 stake
2. **Easier to Manage**: Admins only update amounts, no complex tier management
3. **Better UX**: Clear tier names and priority rules
4. **More Flexible**: Can adjust discount percentages easily
5. **Encourages Staking**: Highest discount for stakers incentivizes staking

## Default Pricing

- **Regular**: 0.00001 ETH (~$0.03 at $3000 ETH)
- **NFT Holder**: 0.000005 ETH (~$0.015 at $3000 ETH) - 50% discount
- **Staker**: 0.000002 ETH (~$0.006 at $3000 ETH) - 80% discount

Admins can adjust these amounts anytime via the admin panel.
