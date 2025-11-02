-- Fix foreign key constraint on shellies_raffle_game_sessions
-- The constraint was too strict - it required users to exist before creating a session
-- But users might pay before being created in the users table
-- Solution: Remove the foreign key constraint or make it less strict

-- Drop the existing foreign key constraint
ALTER TABLE shellies_raffle_game_sessions 
    DROP CONSTRAINT IF EXISTS game_sessions_wallet_address_fkey;

-- Don't add it back - we'll handle user creation in the application layer
-- This allows game sessions to be created even if the user doesn't exist yet
-- The user will be created when they submit their first score

-- Add a comment explaining this decision
COMMENT ON COLUMN shellies_raffle_game_sessions.wallet_address IS 
    'Wallet address of the user. No foreign key constraint to allow session creation before user record exists.';
