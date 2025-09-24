-- Migration: Add prize token fields to raffles table
-- Run this in your Supabase SQL Editor

-- Add prize token fields to shellies_raffle_raffles table
ALTER TABLE shellies_raffle_raffles ADD COLUMN IF NOT EXISTS prize_token_address TEXT;
ALTER TABLE shellies_raffle_raffles ADD COLUMN IF NOT EXISTS prize_token_type TEXT CHECK (prize_token_type IN ('NFT', 'ERC20'));
ALTER TABLE shellies_raffle_raffles ADD COLUMN IF NOT EXISTS prize_token_id TEXT;
ALTER TABLE shellies_raffle_raffles ADD COLUMN IF NOT EXISTS prize_amount TEXT;


-- Add constraints for prize token validation
ALTER TABLE shellies_raffle_raffles ADD CONSTRAINT valid_prize_token_address 
    CHECK (prize_token_address IS NULL OR prize_token_address ~ '^0x[a-fA-F0-9]{40}$');

-- Add constraint to ensure NFTs have token_id and ERC20s have amount
ALTER TABLE shellies_raffle_raffles ADD CONSTRAINT valid_prize_data
    CHECK (
        (prize_token_type = 'NFT' AND prize_token_id IS NOT NULL) OR
        (prize_token_type = 'ERC20' AND prize_amount IS NOT NULL) OR
        (prize_token_type IS NULL)
    );

-- Create index for prize token lookups
CREATE INDEX IF NOT EXISTS idx_shellies_raffles_prize_token 
    ON shellies_raffle_raffles(prize_token_address, prize_token_type);

-- Add comment to document the prize fields structure
COMMENT ON COLUMN shellies_raffle_raffles.prize_token_address IS 'Contract address of the prize token (NFT or ERC20)';
COMMENT ON COLUMN shellies_raffle_raffles.prize_token_type IS 'Type of prize token: NFT or ERC20';
COMMENT ON COLUMN shellies_raffle_raffles.prize_token_id IS 'Token ID for NFT prizes (required for NFT type)';
COMMENT ON COLUMN shellies_raffle_raffles.prize_amount IS 'Amount of tokens for ERC20 prizes (required for ERC20 type)';