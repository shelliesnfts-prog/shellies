# Deployment Checklist - Payment Tier Simplification

## Pre-Deployment

### 1. Environment Variables
- [ ] Verify `NEXT_PUBLIC_STAKING_CONTRACT_ADDRESS` is set in `.env`
- [ ] Verify Supabase credentials are configured
- [ ] Verify RPC endpoints are working

### 2. Code Review
- [ ] All TypeScript files compile without errors
- [ ] No console errors in development
- [ ] All tests pass (if applicable)

### 3. Database Backup
- [ ] Export current `payment_tiers` table as backup
```sql
-- Run in Supabase SQL Editor
SELECT * FROM payment_tiers;
-- Copy results to safe location
```

## Deployment Steps

### Step 1: Run Database Migration
1. Open Supabase SQL Editor
2. Copy contents of `migrations/026_simplify_payment_tiers.sql`
3. Execute the migration
4. Verify results:
```sql
SELECT tier_name, payment_amount_wei, description, is_active 
FROM payment_tiers 
ORDER BY tier_name;
```

Expected output:
- `nft_holder` - 5000000000000 wei
- `regular` - 10000000000000 wei
- `staker` - 2000000000000 wei

### Step 2: Deploy Code
1. Commit all changes to git
2. Push to your deployment branch
3. Deploy to production (Vercel/etc)
4. Wait for deployment to complete

### Step 3: Clear Caches
1. Clear CDN cache (if applicable)
2. Clear browser cache
3. Hard refresh admin panel

## Post-Deployment Testing

### Test 1: Admin Panel
- [ ] Navigate to `/admin/withdrawals`
- [ ] Verify 3 tier cards are displayed
- [ ] Verify tier names: Regular, NFT Holder, Staker
- [ ] Verify discount badges show correct percentages
- [ ] Try updating each tier's payment amount
- [ ] Verify "Add Tier" button is removed
- [ ] Verify "Delete" buttons are removed

### Test 2: API Endpoint
Test with different user types:

**Regular User (no NFTs, no staking):**
```bash
# Should return regular tier
curl -X GET /api/payment-amount \
  -H "Cookie: your-session-cookie"
```
Expected: `tier: "regular"`

**NFT Holder (has NFTs, no staking):**
Expected: `tier: "nft_holder"`

**Staker (has staked NFTs):**
Expected: `tier: "staker"`

### Test 3: Game Console
- [ ] Navigate to `/portal/game`
- [ ] As regular user: No tier badge shown
- [ ] As NFT holder: Blue badge with 🎨 icon, 50% OFF
- [ ] As staker: Purple badge with 🔒 icon, 80% OFF
- [ ] Verify payment amount matches tier
- [ ] Complete a payment and verify it works

### Test 4: Payment Flow
- [ ] Connect wallet
- [ ] Click "Play Game"
- [ ] Verify correct tier pricing shown
- [ ] Complete payment
- [ ] Verify game session created
- [ ] Play game and verify score saves

## Rollback Plan

If issues occur, rollback using these steps:

### 1. Rollback Database
```sql
-- Delete new tiers
DELETE FROM payment_tiers WHERE tier_name IN ('nft_holder', 'staker');

-- Restore old tiers
INSERT INTO payment_tiers (tier_name, payment_amount_wei, min_nfts, max_nfts, description) VALUES
  ('bronze', '5000000000000', 1, 4, 'Bronze tier: 1-4 NFTs (50% discount)'),
  ('silver', '3000000000000', 5, 9, 'Silver tier: 5-9 NFTs (70% discount)'),
  ('gold', '2000000000000', 10, NULL, 'Gold tier: 10+ NFTs (80% discount)')
ON CONFLICT (tier_name) DO NOTHING;
```

### 2. Rollback Code
```bash
git revert <commit-hash>
git push origin main
# Redeploy previous version
```

## Monitoring

### Metrics to Watch
- [ ] Payment success rate
- [ ] Tier distribution (how many users in each tier)
- [ ] API error rates
- [ ] Game session creation rate
- [ ] User complaints/support tickets

### Logs to Check
- [ ] Supabase logs for database errors
- [ ] Application logs for API errors
- [ ] Browser console for frontend errors
- [ ] Wallet transaction logs

## Success Criteria

Deployment is successful when:
- ✅ All 3 tiers are visible in admin panel
- ✅ Users can update tier amounts
- ✅ Correct tier is assigned based on staking/NFT status
- ✅ Payment flow works for all tiers
- ✅ No increase in error rates
- ✅ No user complaints about pricing

## Support

### Common Issues

**Issue: Staker tier not working**
- Check `NEXT_PUBLIC_STAKING_CONTRACT_ADDRESS` in env
- Verify staking contract is accessible
- Check RPC endpoint is responding

**Issue: Wrong tier assigned**
- Clear browser cache
- Check API response for correct tier
- Verify NFT/staking status is correct

**Issue: Admin panel not showing tiers**
- Clear cache and hard refresh
- Check database has 3 tiers
- Check API endpoint `/api/payment-tiers`

### Contact
- Technical issues: Check application logs
- Database issues: Check Supabase dashboard
- User issues: Check support tickets

## Documentation

Updated documentation:
- ✅ PAYMENT_TIER_SIMPLIFICATION.md - Implementation details
- ✅ TIER_SYSTEM_OVERVIEW.md - System architecture
- ✅ MIGRATION_GUIDE_026.md - Migration instructions
- ✅ DEPLOYMENT_CHECKLIST.md - This file

Historical documentation (kept for reference):
- NFT_HOLDER_PRICING_SETUP.md - Old system
- TIER_MANAGEMENT_GUIDE.md - Old system
