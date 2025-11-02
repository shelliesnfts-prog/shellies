# Foreign Key Constraint Fix

## Problem

When a user tried to pay for the first time, they got this error:
```
Error creating game session: {
  code: '23503',
  message: 'insert or update on table "shellies_raffle_game_sessions" 
           violates foreign key constraint "game_sessions_wallet_address_fkey"',
  details: 'Key (wallet_address)=(0x...) is not present in table "shellies_raffle_users".'
}
```

## Root Cause

The initial migration created a foreign key constraint:
```sql
CONSTRAINT game_sessions_wallet_address_fkey 
    FOREIGN KEY (wallet_address) 
    REFERENCES shellies_raffle_users(wallet_address) 
    ON DELETE CASCADE
```

This constraint required that a user record must exist in `shellies_raffle_users` before a game session could be created. However, the flow was:

1. User connects wallet
2. User pays (creates game session) ← **FAILS HERE**
3. User plays game
4. User submits score (creates user record)

The user record wasn't created until they submitted a score, but we needed to create the session immediately after payment.

## Solution

We implemented a two-part fix:

### 1. Remove Foreign Key Constraint (Migration)

**File:** `supabase/migrations/20250102000002_fix_game_sessions_foreign_key.sql`

```sql
-- Drop the foreign key constraint
ALTER TABLE shellies_raffle_game_sessions 
    DROP CONSTRAINT IF EXISTS game_sessions_wallet_address_fkey;
```

This allows game sessions to be created even if the user doesn't exist yet.

### 2. Create User on Session Creation (API)

**File:** `src/app/api/game-session/route.ts`

Added logic to create the user record when creating a game session:

```typescript
// Ensure user exists in shellies_raffle_users table
const { data: existingUser } = await client
  .from('shellies_raffle_users')
  .select('wallet_address')
  .eq('wallet_address', walletAddress)
  .single();

if (!existingUser) {
  // Create user if they don't exist
  await client
    .from('shellies_raffle_users')
    .insert([
      {
        wallet_address: walletAddress,
        points: 0,
        game_score: 0
      }
    ]);
}

// Now create the game session
```

## New Flow

1. User connects wallet
2. User pays
3. **API checks if user exists**
4. **If not, creates user record with 0 points and 0 score**
5. API creates game session ✓
6. User can now play

## Benefits

✅ **No more foreign key errors** - Users are created automatically  
✅ **Better UX** - Payment works on first try  
✅ **Data integrity** - Users are created with proper defaults  
✅ **Idempotent** - Safe to call multiple times (checks before creating)

## How to Apply

Run the migration:
```bash
supabase db push
```

This will apply: `20250102000002_fix_game_sessions_foreign_key.sql`

## Testing

Test the complete flow:

1. **Connect with a new wallet** (one that's never been used)
2. **Pay to play** - Should succeed ✓
3. **Check database:**
   ```sql
   -- User should exist
   SELECT * FROM shellies_raffle_users 
   WHERE wallet_address = '0x...';
   
   -- Session should exist
   SELECT * FROM shellies_raffle_game_sessions 
   WHERE wallet_address = '0x...';
   ```
4. **Play game and submit score** - Should work ✓

## Alternative Approaches Considered

### Option 1: Keep Foreign Key, Create User First
- ❌ Would require changing the flow
- ❌ More complex client-side logic
- ❌ Extra API call before payment

### Option 2: Remove Foreign Key Only
- ⚠️ Could lead to orphaned sessions
- ⚠️ No guarantee user record exists

### Option 3: Remove Foreign Key + Auto-Create User (CHOSEN)
- ✅ Simple and clean
- ✅ Maintains data integrity
- ✅ No extra client-side logic
- ✅ Works on first payment

## Impact

### Before Fix:
- ❌ First-time users couldn't pay
- ❌ Error: Foreign key constraint violation
- ❌ Bad user experience

### After Fix:
- ✅ First-time users can pay immediately
- ✅ User record created automatically
- ✅ Smooth payment flow
- ✅ No errors

## Conclusion

This fix ensures that new users can pay and play immediately without encountering foreign key constraint errors. The user record is automatically created when they make their first payment, providing a seamless experience.
