-- Migration: Remove NFT Count Column and Optimize for Blockchain-Based Claims
-- Run this AFTER running previous migrations

-- Remove nft_count column from users table (it will be checked from blockchain)
ALTER TABLE shellies_raffle_users 
DROP COLUMN IF EXISTS nft_count;

-- Update admin table to also remove nft_count references
-- Update any views or indexes that might reference nft_count

-- Add a claiming_status column for better claim tracking (optional optimization)
ALTER TABLE shellies_raffle_users 
ADD COLUMN claiming_status TEXT DEFAULT 'available' CHECK (claiming_status IN ('available', 'claiming', 'cooldown'));

-- Create an index on last_claim for efficient countdown queries
CREATE INDEX IF NOT EXISTS idx_users_last_claim ON shellies_raffle_users(last_claim);
CREATE INDEX IF NOT EXISTS idx_users_claiming_status ON shellies_raffle_users(claiming_status);

-- Function to calculate time until next claim (returns seconds)
CREATE OR REPLACE FUNCTION get_seconds_until_next_claim(last_claim_timestamp TIMESTAMP WITH TIME ZONE)
RETURNS INTEGER AS $$
DECLARE
    hours_passed NUMERIC;
    seconds_remaining INTEGER;
BEGIN
    -- If never claimed, can claim immediately
    IF last_claim_timestamp IS NULL THEN
        RETURN 0;
    END IF;
    
    -- Calculate hours since last claim
    hours_passed := EXTRACT(EPOCH FROM (NOW() - last_claim_timestamp)) / 3600;
    
    -- If 24+ hours passed, can claim immediately
    IF hours_passed >= 24 THEN
        RETURN 0;
    END IF;
    
    -- Calculate seconds remaining until 24 hours
    seconds_remaining := CEIL((24 - hours_passed) * 3600);
    
    RETURN seconds_remaining;
END;
$$ LANGUAGE plpgsql;

-- Function to check if user can claim (optimized)
CREATE OR REPLACE FUNCTION can_user_claim(user_wallet TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    last_claim_time TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Get last claim time
    SELECT last_claim INTO last_claim_time 
    FROM shellies_raffle_users 
    WHERE wallet_address = user_wallet;
    
    -- If user doesn't exist or never claimed, can claim
    IF last_claim_time IS NULL THEN
        RETURN TRUE;
    END IF;
    
    -- Check if 24 hours have passed
    RETURN (NOW() - last_claim_time) >= INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Function to safely process a claim (prevents double claims)
CREATE OR REPLACE FUNCTION process_user_claim(
    user_wallet TEXT, 
    points_to_add NUMERIC
)
RETURNS TABLE(success BOOLEAN, new_points INTEGER, message TEXT) AS $$
DECLARE
    current_user_id UUID;
    current_points INTEGER;
    last_claim_time TIMESTAMP WITH TIME ZONE;
    can_claim BOOLEAN;
    new_point_total INTEGER;
BEGIN
    -- Start transaction-level locking
    -- Get user with row lock to prevent concurrent claims
    SELECT id, points, last_claim 
    INTO current_user_id, current_points, last_claim_time
    FROM shellies_raffle_users 
    WHERE wallet_address = user_wallet
    FOR UPDATE;
    
    -- If user doesn't exist, create them
    IF current_user_id IS NULL THEN
        INSERT INTO shellies_raffle_users (wallet_address, points, last_claim, claiming_status)
        VALUES (user_wallet, points_to_add::INTEGER, NOW(), 'cooldown')
        RETURNING id, points INTO current_user_id, new_point_total;
        
        RETURN QUERY SELECT TRUE, new_point_total, 'First claim successful!';
        RETURN;
    END IF;
    
    -- Check if user can claim (24 hour cooldown)
    can_claim := (last_claim_time IS NULL OR (NOW() - last_claim_time) >= INTERVAL '24 hours');
    
    IF NOT can_claim THEN
        RETURN QUERY SELECT FALSE, current_points, 'Must wait 24 hours between claims';
        RETURN;
    END IF;
    
    -- Process the claim
    new_point_total := current_points + points_to_add::INTEGER;
    
    UPDATE shellies_raffle_users 
    SET 
        points = new_point_total,
        last_claim = NOW(),
        claiming_status = 'cooldown',
        updated_at = NOW()
    WHERE id = current_user_id;
    
    RETURN QUERY SELECT TRUE, new_point_total, 'Claim successful!';
END;
$$ LANGUAGE plpgsql;

-- Update admin policies to handle new structure
-- Update user management views in admin panel to not show nft_count

-- Comments
COMMENT ON FUNCTION get_seconds_until_next_claim(TIMESTAMP WITH TIME ZONE) IS 'Returns seconds remaining until user can claim again (0 if can claim now)';
COMMENT ON FUNCTION can_user_claim(TEXT) IS 'Checks if user can claim based on 24-hour cooldown';
COMMENT ON FUNCTION process_user_claim(TEXT, NUMERIC) IS 'Safely processes a user claim with proper locking to prevent race conditions';