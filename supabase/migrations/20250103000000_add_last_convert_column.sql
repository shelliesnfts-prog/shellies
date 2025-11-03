-- Add last_convert column to track XP conversion cooldown (once per week)
-- Similar to last_claim but with 7-day restriction instead of 24 hours

ALTER TABLE shellies_raffle_users 
ADD COLUMN IF NOT EXISTS last_convert TIMESTAMPTZ;

-- Add index for performance when checking conversion eligibility
CREATE INDEX IF NOT EXISTS idx_shellies_raffle_users_last_convert 
    ON shellies_raffle_users(last_convert);

-- Add comment
COMMENT ON COLUMN shellies_raffle_users.last_convert IS 'Timestamp of last XP to points conversion (7-day cooldown)';
