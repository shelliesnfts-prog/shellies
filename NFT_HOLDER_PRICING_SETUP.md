# NFT Holder Pricing - Setup Guide

## ✅ Implementation Complete!

All code has been implemented successfully. Here's what was done:

### Files Created/Modified:

#### 1. Database Migration
- ✅ `migrations/025_create_payment_tiers_table.sql` - Run this in Supabase console

#### 2. API Routes (New)
- ✅ `src/app/api/payment-tiers/route.ts` - GET all tiers
- ✅ `src/app/api/payment-tiers/[tier]/route.ts` - UPDATE tier amount
- ✅ `src/app/api/payment-amount/route.ts` - GET user-specific amount

#### 3. Frontend Updates
- ✅ `src/hooks/useGamePayment.ts` - Added NFT check & tier-based pricing
- ✅ `src/app/admin/withdrawals/page.tsx` - Added tier management UI
- ✅ `src/components/MarioGameConsoleV2.tsx` - Added NFT holder discount badge

---

## 🚀 Setup Steps

### Step 1: Run Database Migration

Copy and paste this SQL into your Supabase SQL Editor:

```sql
-- Open the file: migrations/025_create_payment_tiers_table.sql
-- Copy all contents and run in Supabase console
```

This will:
- Create `payment_tiers` table
- Insert default values (regular: 0.00001 ETH, nft_holder: 0.000005 ETH)
- Set up RLS policies

### Step 2: Verify Database

After running the migration, verify in Supabase:

```sql
SELECT * FROM payment_tiers;
```

You should see 4 tiers:
- `regular` tier: 0 NFTs → 10000000000000 wei (0.00001 ETH)
- `bronze` tier: 1-4 NFTs → 5000000000000 wei (0.000005 ETH - 50% off)
- `silver` tier: 5-9 NFTs → 3000000000000 wei (0.000003 ETH - 70% off)
- `gold` tier: 10+ NFTs → 2000000000000 wei (0.000002 ETH - 80% off)

### Step 3: Test the Implementation

1. **Admin Panel** (`/admin/withdrawals`)
   - You should see 4 payment tier cards:
     - 👤 Regular (0 NFTs)
     - 🥉 Bronze (1-4 NFTs) with "50% OFF" badge
     - 🥈 Silver (5-9 NFTs) with "70% OFF" badge
     - 🥇 Gold (10+ NFTs) with "80% OFF" badge
   - Each card shows NFT range and discount
   - Click "Update Amount" on any tier to change pricing

2. **Game Page** (as regular user - 0 NFTs)
   - Should show regular price
   - No discount badge

3. **Game Page** (as Bronze holder - 1-4 NFTs)
   - Should show 50% discounted price
   - Orange "🥉 Bronze Tier Active!" badge
   - Shows NFT count

4. **Game Page** (as Silver holder - 5-9 NFTs)
   - Should show 70% discounted price
   - Silver "🥈 Silver Tier Active!" badge
   - Shows NFT count

5. **Game Page** (as Gold holder - 10+ NFTs)
   - Should show 80% discounted price
   - Gold "🥇 Gold Tier Active!" badge
   - Shows NFT count

---

## 🎯 How It Works

### For Regular Users (0 NFTs):
1. User connects wallet
2. System checks NFT ownership → 0 NFTs
3. Fetches "regular" tier from database
4. Shows regular price (0.00001 ETH)
5. User pays regular amount

### For Bronze Holders (1-4 NFTs):
1. User connects wallet
2. System checks NFT ownership → 2 NFTs ✅
3. Finds matching tier: min_nfts=1, max_nfts=4
4. Fetches "bronze" tier from database
5. Shows discounted price (0.000005 ETH - 50% off)
6. Shows orange "🥉 Bronze Tier" badge with NFT count
7. User pays bronze amount

### For Silver Holders (5-9 NFTs):
1. User connects wallet
2. System checks NFT ownership → 7 NFTs ✅
3. Finds matching tier: min_nfts=5, max_nfts=9
4. Fetches "silver" tier from database
5. Shows discounted price (0.000003 ETH - 70% off)
6. Shows silver "🥈 Silver Tier" badge with NFT count
7. User pays silver amount

### For Gold Holders (10+ NFTs):
1. User connects wallet
2. System checks NFT ownership → 15 NFTs ✅
3. Finds matching tier: min_nfts=10, max_nfts=NULL (unlimited)
4. Fetches "gold" tier from database
5. Shows discounted price (0.000002 ETH - 80% off)
6. Shows gold "🥇 Gold Tier" badge with NFT count
7. User pays gold amount

### Admin Management:
1. Admin goes to `/admin/withdrawals`
2. Sees both tier cards with current amounts
3. Can update either tier independently
4. Changes take effect immediately
5. No contract redeployment needed

---

## 🔍 Testing Checklist

- [ ] Run database migration successfully
- [ ] Verify tiers exist in database
- [ ] Admin can see both tier cards
- [ ] Admin can update regular tier amount
- [ ] Admin can update NFT holder tier amount
- [ ] Regular user sees regular price
- [ ] NFT holder sees discounted price
- [ ] NFT holder sees discount badge
- [ ] Payment works for regular users
- [ ] Payment works for NFT holders
- [ ] Game session stores correct tier info

---

## 📊 Default Pricing Tiers

| Tier | NFT Count | Amount (ETH) | Amount (Wei) | USD (approx) | Discount |
|------|-----------|--------------|--------------|--------------|----------|
| 👤 Regular | 0 | 0.00001 | 10000000000000 | ~$0.04 | 0% |
| 🥉 Bronze | 1-4 | 0.000005 | 5000000000000 | ~$0.02 | 50% |
| 🥈 Silver | 5-9 | 0.000003 | 3000000000000 | ~$0.012 | 70% |
| 🥇 Gold | 10+ | 0.000002 | 2000000000000 | ~$0.008 | 80% |

**The more NFTs you hold, the bigger the discount!**

---

## 🛠️ Customization

### Change Tier Pricing

To change any tier's price:

1. Go to Admin Panel → Withdrawals
2. Click "Update Amount" on the tier you want to change
3. Enter new amount using the ETH/USD converter
4. Click Update

### Add More Tiers

To add a Platinum tier for users with 20+ NFTs (90% discount):

```sql
INSERT INTO payment_tiers (tier_name, payment_amount_wei, min_nfts, max_nfts, description)
VALUES ('platinum', '1000000000000', 20, NULL, 'Platinum tier: 20+ NFTs (90% discount)');
```

**Note:** The system automatically finds the correct tier based on NFT count ranges. No code changes needed!

### Modify Tier Ranges

To change Bronze tier from 1-4 to 1-9 NFTs:

```sql
UPDATE payment_tiers 
SET max_nfts = 9 
WHERE tier_name = 'bronze';
```

---

## 🐛 Troubleshooting

### Issue: Tiers not showing in admin panel
**Solution:** Check browser console for API errors. Verify migration ran successfully.

### Issue: Still showing regular price for NFT holder
**Solution:** 
1. Check NFT contract address is correct in `.env`
2. Verify user actually owns NFTs (check on blockchain explorer)
3. Clear browser cache and reload

### Issue: "Failed to fetch payment amount"
**Solution:** Check API route is accessible at `/api/payment-amount`

---

## 🎉 Benefits Achieved

✅ **No Contract Changes** - Existing contract still works
✅ **Flexible Pricing** - Change anytime without gas costs
✅ **NFT Utility** - Clear value for NFT holders
✅ **Easy Management** - Admin UI for both tiers
✅ **Scalable** - Easy to add more tiers later
✅ **Better UX** - Users see personalized pricing immediately

---

## 📝 Notes

- The smart contract still validates minimum payment amount
- Frontend determines which tier to use based on NFT ownership
- Server validates user paid correct amount for their tier
- All existing functionality remains unchanged
- Backward compatible with current system

---

## 🔐 Security

- RLS policies ensure only admins can update tiers
- Server-side NFT ownership verification
- Payment validation on both client and server
- No way for users to fake their tier

---

## Next Steps (Optional)

1. **Analytics**: Track which tier users are using
2. **A/B Testing**: Test different discount percentages
3. **Time-based**: Add happy hour pricing
4. **Staking Bonus**: Extra discount for staked NFTs
5. **Referral System**: Discount codes for referrals
