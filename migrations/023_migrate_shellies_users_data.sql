-- Migration: Migrate game_score data from shellies_users to shellies_raffle_users
-- Run this in your Supabase SQL Editor AFTER running migration 022

-- This migration handles two scenarios:
-- 1. If wallet_address exists in both tables: Update shellies_raffle_users with game_score from shellies_users
-- 2. If wallet_address only exists in shellies_users: Insert new row in shellies_raffle_users with game_score

-- First, update existing users in shellies_raffle_users with game_score from shellies_users
UPDATE shellies_raffle_users AS sru
SET 
  game_score = COALESCE(su.game_score, 0),
  updated_at = NOW()
FROM shellies_users AS su
WHERE sru.wallet_address = su.wallet_address
  AND su.game_score IS NOT NULL;

-- Then, insert users that exist in shellies_users but not in shellies_raffle_users
-- Only migrating wallet_address and game_score, using defaults for other columns
INSERT INTO shellies_raffle_users (
  wallet_address,
  points,
  game_score,
  created_at,
  updated_at
)
SELECT 
  su.wallet_address,
  0 AS points,                    -- Default value for points
  COALESCE(su.game_score, 0) AS game_score,
  COALESCE(su.created_at, NOW()) AS created_at,
  NOW() AS updated_at
FROM shellies_users AS su
WHERE NOT EXISTS (
  SELECT 1 
  FROM shellies_raffle_users AS sru 
  WHERE sru.wallet_address = su.wallet_address
);

-- Optional: Display migration summary
DO $$
DECLARE
  updated_count INTEGER;
  inserted_count INTEGER;
BEGIN
  -- Count how many records were updated
  SELECT COUNT(*) INTO updated_count
  FROM shellies_raffle_users AS sru
  INNER JOIN shellies_users AS su ON sru.wallet_address = su.wallet_address
  WHERE su.game_score IS NOT NULL;
  
  -- Count how many records were inserted
  SELECT COUNT(*) INTO inserted_count
  FROM shellies_users AS su
  WHERE NOT EXISTS (
    SELECT 1 
    FROM shellies_raffle_users AS sru 
    WHERE sru.wallet_address = su.wallet_address
  );
  
  RAISE NOTICE 'Migration Summary:';
  RAISE NOTICE '- Updated % existing users with game_score', updated_count;
  RAISE NOTICE '- Inserted % new users from shellies_users', inserted_count;
END $$;

-- Note: After verifying the migration was successful, you may want to:
-- 1. Keep shellies_users table as a backup
-- 2. Or drop it if you're confident the migration is complete:
--    DROP TABLE IF EXISTS shellies_users CASCADE;
