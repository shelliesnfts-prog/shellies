-- ============================================================================
-- SECURITY AUDIT: Detect Suspicious Points Activity
-- ============================================================================
-- This script helps identify wallets that may have exploited vulnerabilities
-- to gain excessive points.
--
-- Run this in your Supabase SQL Editor to find suspicious activity.
--
-- UPDATED THRESHOLDS (based on realistic max of 100 NFTs per user):
-- - Max realistic per claim: 2,000 points (100 NFTs × 20 monthly staked)
-- - Max reasonable: 3,000 points (with 50% buffer)
-- - Suspicious: > 1,000 points per claim
-- ============================================================================

-- 1. Find wallets with unusually high points (potential exploit victims)
-- ============================================================================
SELECT 
  wallet_address,
  points,
  game_score,
  last_claim,
  updated_at,
  created_at,
  CASE 
    WHEN points > 10000 THEN '🚨 CRITICAL - Extremely high points (likely exploit)'
    WHEN points > 5000 THEN '⚠️ HIGH - Very high points (investigate)'
    WHEN points > 3000 THEN '⚠️ MEDIUM - Above maximum reasonable'
    ELSE '✅ Normal'
  END as risk_level
FROM shellies_raffle_users
WHERE points > 3000
ORDER BY points DESC
LIMIT 50;

-- 2. Find wallets with impossible point gains (more than max daily claim)
-- ============================================================================
-- Assumptions:
-- - Max realistic NFTs per user: 100
-- - Max daily claim: 100 × 20 (monthly staked) = 2,000 points
-- - Max reasonable: 3,000 points (with buffer)
-- If someone has more than 3k points per day, highly suspicious

SELECT 
  wallet_address,
  points,
  game_score,
  created_at,
  updated_at,
  EXTRACT(DAY FROM (NOW() - created_at)) as days_since_creation,
  ROUND(points / NULLIF(EXTRACT(DAY FROM (NOW() - created_at)), 0), 2) as avg_points_per_day,
  CASE 
    WHEN points / NULLIF(EXTRACT(DAY FROM (NOW() - created_at)), 0) > 3000 THEN '🚨 CRITICAL - Impossible gain rate'
    WHEN points / NULLIF(EXTRACT(DAY FROM (NOW() - created_at)), 0) > 2000 THEN '⚠️ HIGH - Very high gain rate'
    WHEN points / NULLIF(EXTRACT(DAY FROM (NOW() - created_at)), 0) > 1000 THEN '⚠️ MEDIUM - High gain rate'
    ELSE '✅ Normal'
  END as risk_level
FROM shellies_raffle_users
WHERE 
  points > 1000
  AND created_at > NOW() - INTERVAL '30 days'
ORDER BY avg_points_per_day DESC
LIMIT 50;

-- 3. Find wallets updated in the last 24 hours with large point increases
-- ============================================================================
-- This helps identify recent exploitation attempts
SELECT 
  wallet_address,
  points,
  game_score,
  last_claim,
  updated_at,
  EXTRACT(HOUR FROM (NOW() - updated_at)) as hours_since_update,
  CASE 
    WHEN points > 10000 THEN '� CCRITICAL - Likely exploit'
    WHEN points > 5000 THEN '⚠️ HIGH - Very suspicious'
    WHEN points > 3000 THEN '⚠️ MEDIUM - Above max reasonable'
    ELSE '✅ Normal'
  END as risk_level
FROM shellies_raffle_users
WHERE 
  updated_at >= NOW() - INTERVAL '24 hours'
  AND points > 1000
ORDER BY points DESC;

-- 4. Find wallets with points but no game score (suspicious if very high)
-- ============================================================================
-- High points without playing games could indicate exploit
SELECT 
  wallet_address,
  points,
  game_score,
  last_claim,
  created_at,
  CASE 
    WHEN points > 5000 AND (game_score IS NULL OR game_score = 0) THEN '🚨 CRITICAL - High points, no gameplay'
    WHEN points > 3000 AND (game_score IS NULL OR game_score = 0) THEN '⚠️ HIGH - Above max, no gameplay'
    WHEN points > 1000 AND (game_score IS NULL OR game_score = 0) THEN '⚠️ MEDIUM - Suspicious'
    ELSE '✅ Normal'
  END as risk_level
FROM shellies_raffle_users
WHERE 
  (game_score IS NULL OR game_score = 0)
  AND points > 1000
ORDER BY points DESC
LIMIT 50;

-- 5. Find wallets with multiple claims in short time (if cooldown was bypassed)
-- ============================================================================
-- This requires checking if last_claim is being properly enforced
SELECT 
  wallet_address,
  points,
  last_claim,
  updated_at,
  EXTRACT(HOUR FROM (updated_at - last_claim)) as hours_between_claim_and_update,
  CASE 
    WHEN EXTRACT(HOUR FROM (updated_at - last_claim)) < 24 THEN '🚨 CRITICAL - Cooldown bypassed'
    ELSE '✅ Normal'
  END as risk_level
FROM shellies_raffle_users
WHERE 
  last_claim IS NOT NULL
  AND updated_at > last_claim
  AND EXTRACT(HOUR FROM (updated_at - last_claim)) < 24
  AND points > 1000
ORDER BY hours_between_claim_and_update ASC
LIMIT 50;

-- 6. Statistical analysis: Find outliers (3 standard deviations from mean)
-- ============================================================================
WITH stats AS (
  SELECT 
    AVG(points) as mean_points,
    STDDEV(points) as stddev_points
  FROM shellies_raffle_users
  WHERE points > 0
)
SELECT 
  u.wallet_address,
  u.points,
  u.game_score,
  u.created_at,
  ROUND((u.points - s.mean_points) / NULLIF(s.stddev_points, 0), 2) as standard_deviations,
  CASE 
    WHEN (u.points - s.mean_points) / NULLIF(s.stddev_points, 0) > 5 THEN '🚨 CRITICAL - 5+ std dev'
    WHEN (u.points - s.mean_points) / NULLIF(s.stddev_points, 0) > 3 THEN '⚠️ HIGH - 3+ std dev'
    WHEN (u.points - s.mean_points) / NULLIF(s.stddev_points, 0) > 2 THEN '⚠️ MEDIUM - 2+ std dev'
    ELSE '✅ Normal'
  END as risk_level
FROM shellies_raffle_users u
CROSS JOIN stats s
WHERE 
  u.points > 0
  AND (u.points - s.mean_points) / NULLIF(s.stddev_points, 0) > 2
ORDER BY standard_deviations DESC
LIMIT 50;

-- 7. Summary statistics
-- ============================================================================
SELECT 
  COUNT(*) as total_users,
  COUNT(*) FILTER (WHERE points > 0) as users_with_points,
  COUNT(*) FILTER (WHERE points > 1000) as users_over_1k,
  COUNT(*) FILTER (WHERE points > 3000) as users_over_3k,
  COUNT(*) FILTER (WHERE points > 5000) as users_over_5k,
  COUNT(*) FILTER (WHERE points > 10000) as users_over_10k,
  ROUND(AVG(points), 2) as avg_points,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY points), 2) as median_points,
  MAX(points) as max_points,
  MIN(points) as min_points
FROM shellies_raffle_users;

-- 8. Top 20 wallets by points (for manual review)
-- ============================================================================
SELECT 
  wallet_address,
  points,
  game_score,
  last_claim,
  created_at,
  updated_at,
  EXTRACT(DAY FROM (NOW() - created_at)) as account_age_days
FROM shellies_raffle_users
ORDER BY points DESC
LIMIT 20;

-- ============================================================================
-- INSTRUCTIONS:
-- ============================================================================
-- 1. Run each query separately in Supabase SQL Editor
-- 2. Review results marked with 🚨 CRITICAL or ⚠️ HIGH
-- 3. Investigate suspicious wallets manually
-- 4. Consider resetting points for confirmed exploiters
-- 5. Implement fixes from security test suite
-- ============================================================================
