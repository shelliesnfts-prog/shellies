-- Migration 021: Add join transaction hash to raffle entries
-- This migration adds the join_tx_hash column to store blockchain transaction hashes
-- for when users join raffles

-- Add join_tx_hash column to shellies_raffle_entries table
ALTER TABLE shellies_raffle_entries 
ADD COLUMN IF NOT EXISTS join_tx_hash TEXT NULL;

-- Create index for join_tx_hash for performance when querying by transaction hash
CREATE INDEX IF NOT EXISTS idx_shellies_raffle_entries_join_tx_hash 
ON shellies_raffle_entries(join_tx_hash) 
WHERE join_tx_hash IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN shellies_raffle_entries.join_tx_hash IS 'Hash of the blockchain transaction when user joined the raffle';

-- Note: This column is nullable because:
-- 1. Existing entries won't have transaction hashes
-- 2. Future entries should have this populated when users join raffles
-- 3. This allows for backwards compatibility