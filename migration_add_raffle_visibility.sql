-- Migration: Add visibility field to raffles table
-- Description: Adds is_hidden boolean column to allow admins to hide raffles from portal
-- Date: 2025-09-12

-- Add is_hidden column to shellies_raffle_raffles table
ALTER TABLE shellies_raffle_raffles 
ADD COLUMN is_hidden BOOLEAN DEFAULT FALSE;

-- Add comment to document the column purpose
COMMENT ON COLUMN shellies_raffle_raffles.is_hidden IS 'When true, raffle is hidden from portal users but visible to admins';

-- Optional: Add index for better query performance when filtering visible raffles
CREATE INDEX IF NOT EXISTS idx_shellies_raffle_raffles_is_hidden 
ON shellies_raffle_raffles(is_hidden);

-- Verify the column was added successfully
-- You can run this to check: SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'shellies_raffle_raffles' AND column_name = 'is_hidden';