# Raffle Cards Ticket Count Fix - Summary

## Problem
Raffle cards were showing incorrect total tickets sold (e.g., 5,712 instead of 42,215) because:
1. The API was only fetching the first 1,000 entries due to Supabase's default limit
2. Multiple entries from the same wallet weren't being grouped before counting

## Solution Implemented
Created an efficient database function that calculates total tickets sold correctly:

### Database Function (Migration 027)
- **File**: `migrations/027_add_total_tickets_sold_function.sql`
- **Function**: `get_raffle_total_tickets_sold(p_raffle_ids INTEGER[])`
- **How it works**:
  1. Groups entries by wallet_address at database level
  2. Sums tickets per wallet
  3. Returns total tickets for each raffle
  4. All done efficiently in a single database query

### API Changes
- **File**: `src/app/api/raffles/route.ts`
- **Changes**:
  - Uses `get_raffle_total_tickets_sold()` RPC function for efficiency
  - Falls back to manual calculation with pagination if RPC not available
  - Properly groups by wallet before summing tickets

## Files Modified
- ✅ `migrations/027_add_total_tickets_sold_function.sql` - Database function
- ✅ `src/app/api/raffles/route.ts` - API using efficient RPC function

## Files NOT Modified (Reverted)
- ❌ `src/app/api/raffles/[raffleId]/participants/route.ts` - Kept original
- ❌ `src/components/JoinRaffleModal.tsx` - Kept original
- ❌ No pagination changes to participants endpoint

## How to Deploy

### Step 1: Run the Migration
1. Go to Supabase SQL Editor
2. Run `migrations/027_add_total_tickets_sold_function.sql`
3. Verify: `SELECT * FROM get_raffle_total_tickets_sold(ARRAY[117]);`

### Step 2: Test
1. Refresh raffle cards page
2. Verify ticket counts match the detail view
3. Check logs show "Total tickets from RPC function"

## Result
- Raffle cards now show correct ticket counts
- Matches the detail view exactly
- Efficient database-level calculation
- No changes to participants modal or pagination

## Performance
- **Before**: Incorrect count (only first 1000 entries)
- **After**: Correct count, calculated efficiently in database
- **Speed**: Milliseconds (database aggregation)
