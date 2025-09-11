-- Add support for admin wallet deployment tracking
-- Phase 1: Add new columns to track blockchain deployment status

ALTER TABLE shellies_raffle_raffles 
ADD COLUMN IF NOT EXISTS blockchain_tx_hash TEXT NULL,
ADD COLUMN IF NOT EXISTS blockchain_deployed_at TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS blockchain_error TEXT NULL,
ADD COLUMN IF NOT EXISTS blockchain_failed_at TIMESTAMP NULL;

-- Add new status values - moved to separate migration 021_add_blockchain_failed_status.sql
-- ALTER TYPE raffle_status ADD VALUE IF NOT EXISTS 'BLOCKCHAIN_FAILED';

-- Add index for blockchain deployed raffles
CREATE INDEX IF NOT EXISTS idx_raffles_blockchain_status 
ON shellies_raffle_raffles(status, blockchain_deployed_at) 
WHERE blockchain_deployed_at IS NOT NULL;

-- Add comments
COMMENT ON COLUMN shellies_raffle_raffles.blockchain_tx_hash IS 'Hash of the main blockchain transaction (usually the createRaffle tx)';
COMMENT ON COLUMN shellies_raffle_raffles.blockchain_deployed_at IS 'Timestamp when raffle was successfully deployed to blockchain';
COMMENT ON COLUMN shellies_raffle_raffles.blockchain_error IS 'Error message if blockchain deployment failed';
COMMENT ON COLUMN shellies_raffle_raffles.blockchain_failed_at IS 'Timestamp when blockchain deployment failed';