-- Migration: Add game_score column and update function
-- Run this in your Supabase SQL Editor

-- Add game_score column to shellies_raffle_users table
ALTER TABLE shellies_raffle_users 
ADD COLUMN IF NOT EXISTS game_score INTEGER DEFAULT 0;

-- Create index for game_score for leaderboard queries
CREATE INDEX IF NOT EXISTS idx_shellies_users_game_score 
ON shellies_raffle_users(game_score DESC);

-- Create function to update raffle user's game score (only if new score is higher)
-- Using a different name to avoid conflicts with existing function
CREATE OR REPLACE FUNCTION update_raffle_user_game_score(
  user_wallet TEXT,
  new_score INTEGER
) RETURNS TABLE (game_score INTEGER) AS $$
BEGIN
  -- Update the user's game_score only if the new score is higher
  RETURN QUERY
  UPDATE shellies_raffle_users
  SET 
    game_score = GREATEST(shellies_raffle_users.game_score, new_score),
    updated_at = NOW()
  WHERE wallet_address = user_wallet
  RETURNING shellies_raffle_users.game_score;
END;
$$ LANGUAGE plpgsql;
