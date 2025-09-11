# Database Fix Instructions

## Issue
The application code is trying to use a `BLOCKCHAIN_FAILED` enum value that doesn't exist in the database `raffle_status` enum type.

## Immediate Fix Applied
I've implemented a temporary workaround in the code:
- Admin failed raffles are now marked as `CANCELLED` status with `blockchain_error` set to `'BLOCKCHAIN_DEPLOYMENT_FAILED'`
- The raffles API now filters out blockchain-failed raffles by checking for `CANCELLED` status with a non-null `blockchain_error`

## Permanent Database Fix Required

To properly fix this issue, you need to add the `BLOCKCHAIN_FAILED` value to the database enum:

### Step 1: Access your Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor

### Step 2: Run this SQL command
```sql
ALTER TYPE raffle_status ADD VALUE IF NOT EXISTS 'BLOCKCHAIN_FAILED';
```

### Step 3: Verify the change
```sql
SELECT unnest(enum_range(NULL::raffle_status)) as status_values;
```

You should see: `CREATED`, `ACTIVE`, `COMPLETED`, `CANCELLED`, `BLOCKCHAIN_FAILED`

### Step 4: After database update, revert code changes
Once the database is updated, you can revert the temporary workaround by:

1. In `src/app/api/admin/raffles/route.ts` line 163-164, change back to:
```typescript
status: 'BLOCKCHAIN_FAILED',
blockchain_error: blockchainError || 'Unknown blockchain error',
```

2. In `src/app/api/admin/raffles/route.ts` line 175, change back to:
```typescript
status: 'BLOCKCHAIN_FAILED'
```

3. In `src/app/api/raffles/route.ts` line 24, change back to:
```typescript
raffleQuery = raffleQuery.neq('status', 'BLOCKCHAIN_FAILED');
```

## Files Modified
- `migrations/021_add_blockchain_failed_status.sql` (created)
- `src/app/api/admin/raffles/route.ts` (temporary fix)
- `src/app/api/raffles/route.ts` (temporary fix)
- `scripts/add-blockchain-failed-enum.js` (helper script)

## Current Status
✅ Immediate fix applied - application should work now
⏳ Manual database update still required for permanent solution