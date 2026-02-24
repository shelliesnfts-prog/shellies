# Fix for Raffle Ticket Count Bug

## Problem
The raffle cards were showing incorrect ticket counts (e.g., 5,712 instead of 42,215) because the API was only fetching the first 1,000 entries due to Supabase's default limit.

## Solution
Created an efficient database function that calculates total tickets sold by:
1. Grouping entries by wallet address first
2. Summing tickets per wallet
3. Then summing all wallet totals

This matches how we calculate participant counts and is much more efficient than fetching all entries.

## How to Apply the Fix

### Step 1: Run the Database Migration

1. **Go to your Supabase dashboard**
2. **Navigate to SQL Editor**
3. **Copy and paste the content from `migrations/027_add_total_tickets_sold_function.sql`**
4. **Click "Run" to execute the migration**

This will create the `get_raffle_total_tickets_sold()` function in your database.

### Step 2: Verify the Function Works

Run this query in the SQL Editor to test:

```sql
-- Test the function with your raffle IDs
SELECT * FROM get_raffle_total_tickets_sold(ARRAY[117, 116, 115]);
```

You should see correct ticket counts for each raffle.

### Step 3: Deploy the Code Changes

The API code has been updated to:
1. First try to use the efficient RPC function
2. Fall back to manual calculation with pagination if the function doesn't exist

After running the migration, refresh your raffle cards page and the ticket counts should now be correct!

## What Changed

### Files Modified:
- ✅ `src/app/api/raffles/route.ts` - Now uses efficient RPC function
- ✅ `src/components/JoinRaffleModal.tsx` - Updates raffle.total_tickets_sold when fetching participants
- ✅ `migrations/027_add_total_tickets_sold_function.sql` - New database function

### Performance Improvement:
- **Before**: Fetched 11,200+ entries from database, processed in Node.js
- **After**: Database calculates total in a single efficient query
- **Result**: Much faster and more scalable!
