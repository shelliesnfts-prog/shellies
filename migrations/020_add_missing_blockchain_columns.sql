-- Migration 020: Add missing blockchain tracking columns
-- This migration ensures all required blockchain tracking columns exist

-- Add blockchain tracking columns if they don't exist
ALTER TABLE shellies_raffle_raffles 
ADD COLUMN IF NOT EXISTS blockchain_tx_hash TEXT NULL,
ADD COLUMN IF NOT EXISTS blockchain_deployed_at TIMESTAMP WITH TIME ZONE NULL,
ADD COLUMN IF NOT EXISTS blockchain_error TEXT NULL,
ADD COLUMN IF NOT EXISTS blockchain_failed_at TIMESTAMP WITH TIME ZONE NULL;

-- Ensure the status column supports BLOCKCHAIN_FAILED status
-- Note: If you're using an enum type for status, you may need to add this value
-- For text/varchar status columns, this is not needed

-- Add index for blockchain deployed raffles if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_raffles_blockchain_status 
ON shellies_raffle_raffles(status, blockchain_deployed_at) 
WHERE blockchain_deployed_at IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN shellies_raffle_raffles.blockchain_tx_hash IS 'Hash of the main blockchain transaction (usually the createRaffle tx)';
COMMENT ON COLUMN shellies_raffle_raffles.blockchain_deployed_at IS 'Timestamp when raffle was successfully deployed to blockchain';
COMMENT ON COLUMN shellies_raffle_raffles.blockchain_error IS 'Error message if blockchain deployment failed';
COMMENT ON COLUMN shellies_raffle_raffles.blockchain_failed_at IS 'Timestamp when blockchain deployment failed';