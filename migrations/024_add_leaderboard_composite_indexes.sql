-- Migration: Add composite indexes for dual leaderboard system
-- This migration adds composite indexes to optimize leaderboard queries with cursor-based pagination

-- Composite index for game XP leaderboard queries
-- Optimizes: ORDER BY game_score DESC, wallet_address ASC with cursor pagination
CREATE INDEX IF NOT EXISTS idx_shellies_users_game_score_wallet 
ON shellies_raffle_users(game_score DESC, wallet_address ASC);

-- Composite index for points leaderboard queries
-- Optimizes: ORDER BY points DESC, wallet_address ASC with cursor pagination
CREATE INDEX IF NOT EXISTS idx_shellies_users_points_wallet 
ON shellies_raffle_users(points DESC, wallet_address ASC);

-- Add comments to document the indexes
COMMENT ON INDEX idx_shellies_users_game_score_wallet IS 'Composite index for game XP leaderboard with cursor-based pagination';
COMMENT ON INDEX idx_shellies_users_points_wallet IS 'Composite index for points leaderboard with cursor-based pagination';

-- Note: The existing single-column indexes (idx_shellies_users_points and idx_shellies_users_game_score)
-- are kept for backward compatibility and simpler queries that don't require wallet_address ordering
