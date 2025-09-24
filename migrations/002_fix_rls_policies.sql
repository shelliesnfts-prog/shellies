-- Migration: Fix RLS Policies for NextAuth
-- Run this AFTER running the first migration

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Allow users to update own data" ON shellies_raffle_users;
DROP POLICY IF EXISTS "Allow users to insert own data" ON shellies_raffle_users;
DROP POLICY IF EXISTS "Allow users to insert own raffle entries" ON shellies_raffle_entries;

-- Temporarily disable RLS for easier development and testing
-- You can enable this later when you implement proper JWT handling
ALTER TABLE shellies_raffle_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE shellies_raffle_raffles DISABLE ROW LEVEL SECURITY;
ALTER TABLE shellies_raffle_entries DISABLE ROW LEVEL SECURITY;

-- Alternative: If you want to keep RLS enabled, use these simpler policies instead:

-- Re-enable RLS (uncomment these lines if you want RLS enabled)
-- ALTER TABLE shellies_raffle_users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE shellies_raffle_raffles ENABLE ROW LEVEL SECURITY; 
-- ALTER TABLE shellies_raffle_entries ENABLE ROW LEVEL SECURITY;

-- Simple RLS policies that allow authenticated users to manage their own data
-- (uncomment if you enabled RLS above)

-- CREATE POLICY "Allow authenticated users to read all users" ON shellies_raffle_users
--     FOR SELECT TO authenticated USING (true);

-- CREATE POLICY "Allow authenticated users to insert users" ON shellies_raffle_users  
--     FOR INSERT TO authenticated WITH CHECK (true);

-- CREATE POLICY "Allow authenticated users to update users" ON shellies_raffle_users
--     FOR UPDATE TO authenticated USING (true);

-- CREATE POLICY "Allow everyone to read active raffles" ON shellies_raffle_raffles
--     FOR SELECT USING (is_active = true);

-- CREATE POLICY "Allow authenticated users to read raffle entries" ON shellies_raffle_entries
--     FOR SELECT TO authenticated USING (true);

-- CREATE POLICY "Allow authenticated users to insert raffle entries" ON shellies_raffle_entries
--     FOR INSERT TO authenticated WITH CHECK (true);