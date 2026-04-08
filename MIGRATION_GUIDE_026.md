# Migration Guide: Simplify Payment Tiers (026)

## Quick Start

### 1. Open Supabase SQL Editor
Go to your Supabase project → SQL Editor

### 2. Run the Migration
Copy and paste the contents of `migrations/026_simplify_payment_tiers.sql` and execute it.

### 3. Verify Results
Run this query to confirm:
```sql
SELECT 
  tier_name, 
  payment_amount_wei, 
  description,
  is_active
FROM payment_tiers 
ORDER BY 
  CASE tier_name
    WHEN 'regular' THEN 1
    WHEN 'nft_holder' THEN 2
    WHEN 'staker' THEN 3
    ELSE 4
  END;
```

Expected output:
```
tier_name    | payment_amount_wei | description                                      | is_active
-------------+--------------------+--------------------------------------------------+-----------
regular      | 10000000000000     | Regular users without NFT or staking             | true
nft_holder   | 5000000000000      | Users holding at least 1 NFT (50% discount)      | true
staker       | 2000000000000      | Users with staked NFTs (80% discount)            | true
```

## What This Migration Does

1. **Deletes old tiers**: Removes bronze, silver, gold tiers
2. **Updates regular tier**: Removes NFT range constraints
3. **Adds nft_holder tier**: For users with at least 1 NFT
4. **Adds staker tier**: For users with at least 1 staked NFT

## Rollback (if needed)

If you need to rollback, run:
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

## Testing After Migration

1. **Admin Panel**: Visit `/admin/withdrawals` and verify you see 3 tier cards
2. **Update Amounts**: Try updating each tier's payment amount
3. **Game Page**: Visit `/portal/game` and verify the correct tier badge shows
4. **API Test**: Call `/api/payment-amount` and verify it returns correct tier

## Troubleshooting

### Issue: Old tiers still showing
**Solution**: Clear browser cache and refresh the admin panel

### Issue: API returns wrong tier
**Solution**: Check that the migration ran successfully and all 3 tiers exist

### Issue: Staker tier not working
**Solution**: Verify `NEXT_PUBLIC_STAKING_CONTRACT_ADDRESS` is set in `.env`

## Support

If you encounter issues, check:
1. Supabase logs for SQL errors
2. Browser console for API errors
3. Server logs for backend errors
