-- Migration: Optimize indexes for raffle entries operations
-- Add indexes to improve performance of raffle entry queries and validations

-- Index for checking user entries in a specific raffle (used in validation)
CREATE INDEX IF NOT EXISTS idx_raffle_entries_user_raffle 
ON shellies_raffle_entries(user_id, raffle_id);

-- Index for counting total entries per raffle (useful for analytics)
CREATE INDEX IF NOT EXISTS idx_raffle_entries_raffle_created 
ON shellies_raffle_entries(raffle_id, created_at);

-- Index for user's entry history (useful for user profile)
CREATE INDEX IF NOT EXISTS idx_raffle_entries_user_created 
ON shellies_raffle_entries(user_id, created_at DESC);

-- Add comments to document the indexes
COMMENT ON INDEX idx_raffle_entries_user_raffle IS 'Fast lookup for user entries in specific raffles (validation)';
COMMENT ON INDEX idx_raffle_entries_raffle_created IS 'Fast counting and ordering of raffle entries';
COMMENT ON INDEX idx_raffle_entries_user_created IS 'Fast lookup of user entry history';