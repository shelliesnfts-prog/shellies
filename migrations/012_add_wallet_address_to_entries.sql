-- Add wallet_address column to shellies_raffle_entries table
ALTER TABLE shellies_raffle_entries 
ADD COLUMN wallet_address TEXT;

-- Create index for performance
CREATE INDEX idx_shellies_raffle_entries_wallet_address ON shellies_raffle_entries(wallet_address);

-- Create composite index for raffle_id + wallet_address queries
CREATE INDEX idx_shellies_raffle_entries_raffle_wallet ON shellies_raffle_entries(raffle_id, wallet_address);

-- Populate wallet_address from existing user_id relationships (if data exists)
UPDATE shellies_raffle_entries 
SET wallet_address = (
  SELECT wallet_address 
  FROM shellies_raffle_users 
  WHERE shellies_raffle_users.id = shellies_raffle_entries.user_id
)
WHERE user_id IS NOT NULL;

-- Make wallet_address NOT NULL after population
ALTER TABLE shellies_raffle_entries 
ALTER COLUMN wallet_address SET NOT NULL;

-- Drop the old user_id column (uncomment when ready)
-- ALTER TABLE shellies_raffle_entries DROP COLUMN user_id;