-- Migration: Add BLOCKCHAIN_FAILED status to raffle_status enum
-- Date: 2025-01-15
-- Description: Adds BLOCKCHAIN_FAILED status for handling smart contract deployment failures

-- Add new enum value to raffle_status
ALTER TYPE raffle_status ADD VALUE IF NOT EXISTS 'BLOCKCHAIN_FAILED';

-- Add comment to update documentation
COMMENT ON TYPE raffle_status IS 'Raffle status matching smart contract RaffleState enum: CREATED, ACTIVE, COMPLETED, CANCELLED, BLOCKCHAIN_FAILED';