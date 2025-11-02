# Table Rename Migration Guide

## Overview
This guide explains the table rename from `game_sessions` to `shellies_raffle_game_sessions` to follow the project's naming convention.

## Why Rename?
All tables in this project follow the naming pattern: `shellies_raffle_{table_name}`

Examples:
- `shellies_raffle_users`
- `shellies_raffle_raffles`
- `shellies_raffle_raffle_entries`
- `shellies_raffle_game_sessions` ← New table

## Migration Files

### 1. Initial Creation (20250102000000_create_game_sessions.sql)
Created the table with the name `game_sessions`

### 2. Rename Migration (20250102000001_rename_game_sessions_table.sql)
Renames the table to `shellies_raffle_game_sessions` and updates:
- Table name
- Index names
- RLS policy names
- Comments

## What Gets Updated

### Database Changes
```sql
-- Old table name
game_sessions

-- New table name
shellies_raffle_game_sessions

-- Old indexes
idx_game_sessions_wallet_active
idx_game_sessions_tx_hash

-- New indexes
idx_shellies_raffle_game_sessions_wallet_active
idx_shellies_raffle_game_sessions_tx_hash
```

### Code Changes
All references to `game_sessions` in the codebase have been updated to `shellies_raffle_game_sessions`:

**Files Updated:**
- `src/app/api/game-session/route.ts` (4 occurrences)
- `src/app/api/game-score/route.ts` (1 occurrence)
- `docs/GAME_PAYMENT_SECURITY.md`
- `docs/PAYMENT_SESSION_FLOW.md`
- `SECURITY_IMPLEMENTATION_SUMMARY.md`

## How to Apply

### If You Already Ran the First Migration:
```bash
# Just run the rename migration
supabase db push

# This will apply: 20250102000001_rename_game_sessions_table.sql
```

### If You Haven't Run Any Migrations Yet:
```bash
# Run all migrations at once
supabase db push

# This will apply both:
# 1. 20250102000000_create_game_sessions.sql
# 2. 20250102000001_rename_game_sessions_table.sql
```

## Verification

After running the migration, verify the table exists with the correct name:

```sql
-- Check table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'shellies_raffle_game_sessions';

-- Check indexes exist
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'shellies_raffle_game_sessions';

-- Expected indexes:
-- - idx_shellies_raffle_game_sessions_wallet_active
-- - idx_shellies_raffle_game_sessions_tx_hash

-- Check RLS policies
SELECT policyname 
FROM pg_policies 
WHERE tablename = 'shellies_raffle_game_sessions';

-- Expected policies:
-- - Users can view own game sessions
-- - Service role can manage game sessions
```

## Rollback (If Needed)

If you need to rollback the rename:

```sql
-- Rename back to original name
ALTER TABLE shellies_raffle_game_sessions RENAME TO game_sessions;

-- Update indexes
ALTER INDEX idx_shellies_raffle_game_sessions_wallet_active 
    RENAME TO idx_game_sessions_wallet_active;
    
ALTER INDEX idx_shellies_raffle_game_sessions_tx_hash 
    RENAME TO idx_game_sessions_tx_hash;

-- Note: You'll also need to revert code changes
```

## Testing After Migration

1. **Test Session Creation:**
   ```bash
   # Make a payment and verify session is created
   curl -X POST http://localhost:3000/api/game-session \
     -H "Content-Type: application/json" \
     -d '{"transactionHash": "0x..."}'
   ```

2. **Test Session Verification:**
   ```bash
   # Check if session exists
   curl http://localhost:3000/api/game-session
   ```

3. **Test Score Submission:**
   ```bash
   # Submit a score (should verify session)
   curl -X POST http://localhost:3000/api/game-score \
     -H "Content-Type: application/json" \
     -d '{"score": 100, "walletAddress": "0x..."}'
   ```

## Impact

### No Impact On:
- ✅ Existing functionality
- ✅ User experience
- ✅ API endpoints
- ✅ Client-side code

### Changes:
- ✅ Database table name
- ✅ Index names
- ✅ Policy names
- ✅ Internal API queries

## Conclusion

This is a simple rename operation that brings the table name in line with the project's naming convention. All functionality remains the same, only the internal table name has changed.
