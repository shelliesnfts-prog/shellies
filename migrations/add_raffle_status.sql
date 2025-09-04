-- Migration: Add status column to raffles table
-- Date: 2025-01-15
-- Description: Adds status enum column to match smart contract RaffleState

-- Create enum type for raffle status
CREATE TYPE raffle_status AS ENUM ('CREATED', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- Add status column to raffles table
ALTER TABLE shellies_raffle_raffles 
ADD COLUMN status raffle_status NOT NULL DEFAULT 'CREATED';

-- Add index for better query performance
CREATE INDEX idx_shellies_raffles_status ON shellies_raffle_raffles(status);

-- Update existing raffles based on current data
-- Assuming raffles with end_date in the past are completed
-- Assuming raffles with end_date in the future are active
UPDATE shellies_raffle_raffles 
SET status = CASE 
    WHEN end_date < NOW() THEN 'COMPLETED'::raffle_status
    WHEN end_date > NOW() THEN 'ACTIVE'::raffle_status
    ELSE 'CREATED'::raffle_status
END;

-- Add comment to document the column
COMMENT ON COLUMN shellies_raffle_raffles.status IS 'Raffle status matching smart contract RaffleState enum: CREATED, ACTIVE, COMPLETED, CANCELLED';