-- Migration: Add sequential integer raffle_id column
-- This adds a sequential integer ID to work with smart contracts that use uint256
-- Run this in your Supabase SQL Editor

-- Step 1: Add the new sequential raffle_id column
ALTER TABLE shellies_raffle_raffles 
ADD COLUMN raffle_id SERIAL UNIQUE;

-- Step 2: Create index for the new raffle_id column
CREATE INDEX idx_shellies_raffles_raffle_id ON shellies_raffle_raffles(raffle_id);

-- Step 3: Add comment to document the new column
COMMENT ON COLUMN shellies_raffle_raffles.raffle_id IS 'Sequential integer ID for smart contract compatibility (maps to uint256)';

-- Step 4: Update existing raffles to have sequential IDs (if any exist)
-- This will automatically assign sequential numbers starting from 1
-- No action needed - SERIAL handles this automatically

-- Step 5: Create a function to get raffle by sequential ID
CREATE OR REPLACE FUNCTION get_raffle_by_sequential_id(seq_id INTEGER)
RETURNS TABLE(
    id UUID,
    raffle_id INTEGER,
    title TEXT,
    description TEXT,
    image_url TEXT,
    points_per_ticket INTEGER,
    max_tickets_per_user INTEGER,
    max_participants INTEGER,
    end_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    prize_token_address TEXT,
    prize_token_type TEXT,
    prize_token_id TEXT,
    prize_amount TEXT
)
LANGUAGE sql
AS $$
    SELECT 
        r.id,
        r.raffle_id,
        r.title,
        r.description,
        r.image_url,
        r.points_per_ticket,
        r.max_tickets_per_user,
        r.max_participants,
        r.end_date,
        r.created_at,
        r.prize_token_address,
        r.prize_token_type,
        r.prize_token_id,
        r.prize_amount
    FROM shellies_raffle_raffles r 
    WHERE r.raffle_id = seq_id;
$$;

-- Step 6: Create a function to get the next raffle_id for new raffles
CREATE OR REPLACE FUNCTION get_next_raffle_id()
RETURNS INTEGER
LANGUAGE sql
AS $$
    SELECT COALESCE(MAX(raffle_id), 0) + 1 FROM shellies_raffle_raffles;
$$;

-- Step 7: Create a trigger to ensure raffle_id is always set for new records
CREATE OR REPLACE FUNCTION ensure_raffle_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- If raffle_id is not set, get the next sequential ID
    IF NEW.raffle_id IS NULL THEN
        NEW.raffle_id := (SELECT COALESCE(MAX(raffle_id), 0) + 1 FROM shellies_raffle_raffles);
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_ensure_raffle_id
    BEFORE INSERT ON shellies_raffle_raffles
    FOR EACH ROW
    EXECUTE FUNCTION ensure_raffle_id();

-- Step 8: Add RLS policy for the new column (if RLS is enabled)
-- This ensures the raffle_id column follows the same security rules
-- Note: Existing RLS policies should automatically cover the new column

-- Verification query - run this to check the migration worked
-- SELECT id, raffle_id, title, created_at FROM shellies_raffle_raffles ORDER BY raffle_id;

-- Example: Your existing raffle should now have raffle_id = 1
-- Future raffles will get raffle_id = 2, 3, 4, etc.