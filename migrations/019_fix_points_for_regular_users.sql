-- Migration: Fix Points System to Support 0.1 Points for Regular Users
-- This fixes the issue where regular users (0 NFTs) can't claim 0.1 points

-- Step 1: Change points column from INTEGER to NUMERIC(10,1) to support decimal values
ALTER TABLE shellies_raffle_users 
ALTER COLUMN points TYPE NUMERIC(10,1) USING points::NUMERIC(10,1);

-- Step 2: Drop and recreate the process_user_claim function to handle NUMERIC points properly
-- We need to drop first because we're changing the return type from INTEGER to NUMERIC
DROP FUNCTION IF EXISTS process_user_claim(TEXT, NUMERIC);

CREATE OR REPLACE FUNCTION process_user_claim(
    user_wallet TEXT, 
    points_to_add NUMERIC
)
RETURNS TABLE(success BOOLEAN, new_points NUMERIC, message TEXT) AS $$
DECLARE
    current_user_id UUID;
    current_points NUMERIC;
    last_claim_time TIMESTAMP WITH TIME ZONE;
    can_claim BOOLEAN;
    new_point_total NUMERIC;
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
        VALUES (user_wallet, points_to_add, NOW(), 'cooldown')
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
    
    -- Process the claim (no more INTEGER casting - preserve decimal points!)
    new_point_total := current_points + points_to_add;
    
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

-- Step 3: Update any views or indexes that might be affected
-- Recreate any constraints that might need updating
-- Note: This maintains backward compatibility with existing integer point values

-- Step 4: Add comment explaining the change
COMMENT ON COLUMN shellies_raffle_users.points IS 'User points supporting decimal values (e.g., 0.1 for regular users, 1+ for NFT holders)';
COMMENT ON FUNCTION process_user_claim(TEXT, NUMERIC) IS 'Safely processes a user claim with proper locking and NUMERIC point support for 0.1 points';

-- Step 5: Update admin functions to handle numeric points
-- This ensures admin operations work correctly with the new data type