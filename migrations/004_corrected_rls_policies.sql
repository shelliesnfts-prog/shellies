-- Migration: Corrected RLS Policies (Fixed PostgreSQL Syntax)
-- Run this AFTER running the first migration (you can skip 002 and 003)

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
DROP POLICY IF EXISTS "authenticated_users_can_read_all_users" ON shellies_raffle_users;
DROP POLICY IF EXISTS "authenticated_users_can_insert_unique_wallet" ON shellies_raffle_users;
DROP POLICY IF EXISTS "authenticated_users_can_update_own_data" ON shellies_raffle_users;
DROP POLICY IF EXISTS "anyone_can_read_active_raffles" ON shellies_raffle_raffles;
DROP POLICY IF EXISTS "authenticated_users_can_read_raffle_entries" ON shellies_raffle_entries;
DROP POLICY IF EXISTS "authenticated_users_can_insert_unique_raffle_entry" ON shellies_raffle_entries;
DROP POLICY IF EXISTS "authenticated_users_can_update_own_raffle_entries" ON shellies_raffle_entries;

-- ===== SHELLIES_RAFFLE_USERS POLICIES =====

-- Allow authenticated users to read all users (for leaderboard)
CREATE POLICY "authenticated_users_can_read_all_users" ON shellies_raffle_users
    FOR SELECT TO authenticated USING (true);

-- Allow authenticated users to insert users (unique constraint will prevent duplicates)
CREATE POLICY "authenticated_users_can_insert_users" ON shellies_raffle_users
    FOR INSERT TO authenticated 
    WITH CHECK (true);

-- Allow authenticated users to update all user records (for server-side operations)
CREATE POLICY "authenticated_users_can_update_users" ON shellies_raffle_users
    FOR UPDATE TO authenticated 
    USING (true);

-- ===== SHELLIES_RAFFLE_RAFFLES POLICIES =====

-- Allow everyone to read active raffles (public data)
CREATE POLICY "anyone_can_read_active_raffles" ON shellies_raffle_raffles
    FOR SELECT USING (is_active = true);

-- ===== SHELLIES_RAFFLE_ENTRIES POLICIES =====

-- Allow authenticated users to read all raffle entries
CREATE POLICY "authenticated_users_can_read_raffle_entries" ON shellies_raffle_entries
    FOR SELECT TO authenticated USING (true);

-- Allow authenticated users to insert raffle entries (unique constraint will prevent duplicates)
CREATE POLICY "authenticated_users_can_insert_raffle_entries" ON shellies_raffle_entries
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- Allow authenticated users to update raffle entries
CREATE POLICY "authenticated_users_can_update_raffle_entries" ON shellies_raffle_entries
    FOR UPDATE TO authenticated
    USING (true);

-- Add unique constraints at database level for safety
-- (These will handle the business logic for preventing duplicates)

-- Ensure unique wallet addresses
ALTER TABLE shellies_raffle_users 
DROP CONSTRAINT IF EXISTS unique_wallet_address;

ALTER TABLE shellies_raffle_users 
ADD CONSTRAINT unique_wallet_address UNIQUE (wallet_address);

-- Ensure unique user+raffle combinations  
ALTER TABLE shellies_raffle_entries 
DROP CONSTRAINT IF EXISTS shellies_raffle_entries_user_id_raffle_id_key;

ALTER TABLE shellies_raffle_entries 
DROP CONSTRAINT IF EXISTS unique_user_raffle_entry;

ALTER TABLE shellies_raffle_entries 
ADD CONSTRAINT unique_user_raffle_entry UNIQUE (user_id, raffle_id);

-- Add helpful comments
COMMENT ON POLICY "authenticated_users_can_read_all_users" ON shellies_raffle_users IS 
'Allows authenticated users to read all user profiles for leaderboard functionality';

COMMENT ON POLICY "authenticated_users_can_insert_users" ON shellies_raffle_users IS 
'Allows user creation - unique constraint prevents duplicate wallet addresses';

COMMENT ON POLICY "authenticated_users_can_update_users" ON shellies_raffle_users IS 
'Allows user updates for server-side operations like point management';

COMMENT ON POLICY "authenticated_users_can_insert_raffle_entries" ON shellies_raffle_entries IS 
'Allows raffle entries - unique constraint prevents duplicate entries per user per raffle';