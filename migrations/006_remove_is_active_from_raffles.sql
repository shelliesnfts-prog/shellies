-- Migration: Remove is_active column from raffles table and add max_participants
-- This migration removes the is_active column, handles policy dependencies, and adds max_participants

-- First, drop the policy that depends on is_active column
DROP POLICY IF EXISTS "raffles_can_be_read_by_anyone" ON shellies_raffle_raffles;

-- Add max_participants column first
ALTER TABLE shellies_raffle_raffles ADD COLUMN IF NOT EXISTS max_participants INTEGER DEFAULT NULL;

-- Now remove the is_active column
ALTER TABLE shellies_raffle_raffles DROP COLUMN IF EXISTS is_active;

-- Recreate the policy without the is_active dependency
-- Allow all authenticated users to read raffles (status determined by end_date)
CREATE POLICY "raffles_can_be_read_by_anyone" ON shellies_raffle_raffles
  FOR SELECT USING (true);

-- Add comment to document the changes
COMMENT ON TABLE shellies_raffle_raffles IS 'Raffles table - status determined by end_date vs current timestamp, with max_participants limit';
COMMENT ON COLUMN shellies_raffle_raffles.max_participants IS 'Maximum number of participants allowed in the raffle (NULL = unlimited)';