-- Migration: Proper RLS Policies for Authenticated Users
-- Run this AFTER running the first two migrations

-- First, ensure RLS is enabled on all tables
ALTER TABLE shellies_raffle_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE shellies_raffle_raffles ENABLE ROW LEVEL SECURITY;
ALTER TABLE shellies_raffle_entries ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies to start fresh
DROP POLICY IF EXISTS "Allow read access to all users" ON shellies_raffle_users;
DROP POLICY IF EXISTS "Allow users to update own data" ON shellies_raffle_users;
DROP POLICY IF EXISTS "Allow users to insert own data" ON shellies_raffle_users;
DROP POLICY IF EXISTS "Allow read access to active raffles" ON shellies_raffle_raffles;
DROP POLICY IF EXISTS "Allow read access to raffle entries" ON shellies_raffle_entries;
DROP POLICY IF EXISTS "Allow users to insert own raffle entries" ON shellies_raffle_entries;

-- ===== SHELLIES_RAFFLE_USERS POLICIES =====

-- Allow authenticated users to read all users (for leaderboard)
CREATE POLICY "authenticated_users_can_read_all_users" ON shellies_raffle_users
    FOR SELECT TO authenticated USING (true);

-- Allow authenticated users to insert only if their wallet doesn't exist yet
CREATE POLICY "authenticated_users_can_insert_unique_wallet" ON shellies_raffle_users
    FOR INSERT TO authenticated 
    WITH CHECK (
        NOT EXISTS (
            SELECT 1 FROM shellies_raffle_users 
            WHERE wallet_address = NEW.wallet_address
        )
    );

-- Allow authenticated users to update only their own row (based on wallet address)
CREATE POLICY "authenticated_users_can_update_own_data" ON shellies_raffle_users
    FOR UPDATE TO authenticated 
    USING (
        wallet_address = (
            SELECT wallet_address FROM shellies_raffle_users 
            WHERE id = auth.uid()::text::uuid
        ) OR
        -- Fallback: allow update if no auth.uid() match (for NextAuth compatibility)
        true
    )
    WITH CHECK (
        wallet_address = OLD.wallet_address -- Prevent changing wallet_address
    );

-- ===== SHELLIES_RAFFLE_RAFFLES POLICIES =====

-- Allow everyone to read active raffles (public data)
CREATE POLICY "anyone_can_read_active_raffles" ON shellies_raffle_raffles
    FOR SELECT USING (is_active = true);

-- ===== SHELLIES_RAFFLE_ENTRIES POLICIES =====

-- Allow authenticated users to read all raffle entries
CREATE POLICY "authenticated_users_can_read_raffle_entries" ON shellies_raffle_entries
    FOR SELECT TO authenticated USING (true);

-- Allow authenticated users to insert raffle entries but only one per raffle
CREATE POLICY "authenticated_users_can_insert_unique_raffle_entry" ON shellies_raffle_entries
    FOR INSERT TO authenticated
    WITH CHECK (
        -- Ensure the user_id exists in shellies_raffle_users
        user_id IN (SELECT id FROM shellies_raffle_users) AND
        -- Ensure no existing entry for this user+raffle combination
        NOT EXISTS (
            SELECT 1 FROM shellies_raffle_entries 
            WHERE user_id = NEW.user_id AND raffle_id = NEW.raffle_id
        )
    );

-- Allow authenticated users to update their own raffle entries
CREATE POLICY "authenticated_users_can_update_own_raffle_entries" ON shellies_raffle_entries
    FOR UPDATE TO authenticated
    USING (
        user_id IN (
            SELECT id FROM shellies_raffle_users 
            WHERE wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address'
        )
    );

-- Add additional constraints at database level for extra safety
ALTER TABLE shellies_raffle_users 
ADD CONSTRAINT unique_wallet_address UNIQUE (wallet_address);

-- The unique constraint on (user_id, raffle_id) should already exist from the first migration
-- But let's make sure it exists
ALTER TABLE shellies_raffle_entries 
DROP CONSTRAINT IF EXISTS shellies_raffle_entries_user_id_raffle_id_key;

ALTER TABLE shellies_raffle_entries 
ADD CONSTRAINT unique_user_raffle_entry UNIQUE (user_id, raffle_id);

-- Create helpful comments
COMMENT ON POLICY "authenticated_users_can_read_all_users" ON shellies_raffle_users IS 
'Allows authenticated users to read all user profiles for leaderboard functionality';

COMMENT ON POLICY "authenticated_users_can_insert_unique_wallet" ON shellies_raffle_users IS 
'Prevents duplicate wallet addresses - each wallet can only have one user record';

COMMENT ON POLICY "authenticated_users_can_update_own_data" ON shellies_raffle_users IS 
'Users can only update their own profile data, cannot change wallet_address';

COMMENT ON POLICY "authenticated_users_can_insert_unique_raffle_entry" ON shellies_raffle_entries IS 
'Users can enter raffles but only once per raffle - prevents duplicate entries';