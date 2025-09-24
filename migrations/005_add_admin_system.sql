-- Migration: Add Admin System
-- Run this AFTER running migrations 001 and 004

-- Create admin table
CREATE TABLE shellies_raffle_admins (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet_address TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by TEXT, -- Optional: track who added this admin
    is_active BOOLEAN DEFAULT true
);

-- Add indexes
CREATE INDEX idx_admin_wallet_address ON shellies_raffle_admins(wallet_address);
CREATE INDEX idx_admin_active ON shellies_raffle_admins(is_active);

-- Enable RLS on admin table
ALTER TABLE shellies_raffle_admins ENABLE ROW LEVEL SECURITY;

-- Admin table policies
CREATE POLICY "anyone_can_read_active_admins" ON shellies_raffle_admins
    FOR SELECT USING (is_active = true);

CREATE POLICY "admins_can_manage_admins" ON shellies_raffle_admins
    FOR ALL TO authenticated 
    USING (
        -- Allow if current user is an admin
        EXISTS (
            SELECT 1 FROM shellies_raffle_admins 
            WHERE wallet_address = current_setting('app.current_user_wallet', true) 
            AND is_active = true
        )
    );

-- Update existing RLS policies to allow admin access

-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "authenticated_users_can_insert_users" ON shellies_raffle_users;
DROP POLICY IF EXISTS "authenticated_users_can_update_users" ON shellies_raffle_users;

DROP POLICY IF EXISTS "anyone_can_read_active_raffles" ON shellies_raffle_raffles;

-- Updated user policies (allow admin access)
CREATE POLICY "users_can_be_read_by_authenticated" ON shellies_raffle_users
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "users_can_be_inserted_by_authenticated_or_admin" ON shellies_raffle_users
    FOR INSERT TO authenticated 
    WITH CHECK (
        -- Allow regular user creation OR admin access
        true OR
        EXISTS (
            SELECT 1 FROM shellies_raffle_admins 
            WHERE wallet_address = current_setting('app.current_user_wallet', true) 
            AND is_active = true
        )
    );

CREATE POLICY "users_can_be_updated_by_authenticated_or_admin" ON shellies_raffle_users
    FOR UPDATE TO authenticated 
    USING (
        -- Allow regular updates OR admin access
        true OR
        EXISTS (
            SELECT 1 FROM shellies_raffle_admins 
            WHERE wallet_address = current_setting('app.current_user_wallet', true) 
            AND is_active = true
        )
    );

CREATE POLICY "users_can_be_deleted_by_admin" ON shellies_raffle_users
    FOR DELETE TO authenticated 
    USING (
        -- Only admins can delete users
        EXISTS (
            SELECT 1 FROM shellies_raffle_admins 
            WHERE wallet_address = current_setting('app.current_user_wallet', true) 
            AND is_active = true
        )
    );

-- Updated raffle policies (allow admin to manage raffles)
CREATE POLICY "raffles_can_be_read_by_anyone" ON shellies_raffle_raffles
    FOR SELECT USING (is_active = true);

CREATE POLICY "raffles_can_be_managed_by_admin" ON shellies_raffle_raffles
    FOR ALL TO authenticated
    USING (
        -- Only admins can manage raffles
        EXISTS (
            SELECT 1 FROM shellies_raffle_admins 
            WHERE wallet_address = current_setting('app.current_user_wallet', true) 
            AND is_active = true
        )
    );

-- Function to check if a wallet is admin
CREATE OR REPLACE FUNCTION is_admin(wallet_addr TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM shellies_raffle_admins 
        WHERE wallet_address = wallet_addr 
        AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to set current user context (for RLS)
CREATE OR REPLACE FUNCTION set_current_user_wallet(wallet_addr TEXT)
RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.current_user_wallet', wallet_addr, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add your wallet as the first admin (replace with your actual wallet address)
-- INSERT INTO shellies_raffle_admins (wallet_address, created_by, is_active) 
-- VALUES ('0xYourWalletAddressHere', 'system', true);

-- Comments for documentation
COMMENT ON TABLE shellies_raffle_admins IS 'Stores wallet addresses of system administrators';
COMMENT ON FUNCTION is_admin(TEXT) IS 'Checks if a wallet address has admin privileges';
COMMENT ON FUNCTION set_current_user_wallet(TEXT) IS 'Sets the current user wallet for RLS context';