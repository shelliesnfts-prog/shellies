-- Migration 030: Rename off-chain points columns to legacy
--
-- Run this AFTER:
--   1. ShelliesPoints contract is deployed
--   2. Migration script (migrate-points-onchain.ts) has been run
--   3. All API routes confirmed reading from on-chain contract
--
-- These columns become read-only historical records.
-- The source of truth for points is now the ShelliesPoints contract.

ALTER TABLE shellies_raffle_users
  RENAME COLUMN points TO points_legacy;

ALTER TABLE shellies_raffle_users
  RENAME COLUMN last_claim TO last_claim_legacy;

-- Add a comment so future devs know what happened
COMMENT ON COLUMN shellies_raffle_users.points_legacy IS
  'Legacy off-chain points balance. Superseded by ShelliesPoints on-chain contract. Do not write to this column.';

COMMENT ON COLUMN shellies_raffle_users.last_claim_legacy IS
  'Legacy last claim timestamp. Superseded by lastClaim mapping on ShelliesPoints contract. Do not write to this column.';
