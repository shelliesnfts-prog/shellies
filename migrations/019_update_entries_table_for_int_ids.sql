-- Update shellies_raffle_entries table to use INTEGER IDs instead of UUID

-- First check current table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'shellies_raffle_entries' 
ORDER BY ordinal_position;

-- Check if there are any existing entries (backup if needed)
SELECT COUNT(*) FROM shellies_raffle_entries;

-- Since we're changing the primary/foreign key types, we need to:
-- 1. Drop foreign key constraints
-- 2. Update the column types
-- 3. Recreate the constraints

-- Drop foreign key constraints first
ALTER TABLE shellies_raffle_entries DROP CONSTRAINT IF EXISTS shellies_raffle_entries_user_id_fkey;
ALTER TABLE shellies_raffle_entries DROP CONSTRAINT IF EXISTS shellies_raffle_entries_raffle_id_fkey;

-- Update raffle_id from UUID to INTEGER
ALTER TABLE shellies_raffle_entries ALTER COLUMN raffle_id TYPE INTEGER USING raffle_id::INTEGER;

-- Add user_id column as UUID (to match users table)
ALTER TABLE shellies_raffle_entries ADD COLUMN user_id UUID;

-- Recreate foreign key constraints
ALTER TABLE shellies_raffle_entries 
ADD CONSTRAINT shellies_raffle_entries_raffle_id_fkey 
FOREIGN KEY (raffle_id) REFERENCES shellies_raffle_raffles(id) ON DELETE CASCADE;

ALTER TABLE shellies_raffle_entries 
ADD CONSTRAINT shellies_raffle_entries_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES shellies_raffle_users(id) ON DELETE CASCADE;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_entries_wallet_raffle ON shellies_raffle_entries(wallet_address, raffle_id);
CREATE INDEX IF NOT EXISTS idx_entries_raffle_id ON shellies_raffle_entries(raffle_id);

-- Verify the updated structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'shellies_raffle_entries' 
ORDER BY ordinal_position;

-- Check that the data is still intact
SELECT COUNT(*) FROM shellies_raffle_entries;