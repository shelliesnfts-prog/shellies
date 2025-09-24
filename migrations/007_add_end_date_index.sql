-- Migration: Add optimized index for end_date queries
-- This migration adds a dedicated index on end_date for efficient raffle status queries

-- Drop the old composite index if it still exists (it may have been removed with is_active column)
DROP INDEX IF EXISTS idx_shellies_raffles_active;

-- Create new dedicated index on end_date for fast filtering
CREATE INDEX IF NOT EXISTS idx_shellies_raffles_end_date ON shellies_raffle_raffles(end_date);

-- Add comment to document the index purpose
COMMENT ON INDEX idx_shellies_raffles_end_date IS 'Index for efficient filtering of active/finished raffles by end_date';