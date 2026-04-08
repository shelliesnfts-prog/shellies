-- Migration 031: Drop legacy off-chain points DB functions
--
-- Run this AFTER migration 030 and after confirming:
--   1. All active raffles have ended (no entries being written via old flow)
--   2. /api/raffle-entries/enter is confirmed using on-chain verification
--   3. Claiming is confirmed going through ShelliesPoints contract directly
--   4. No application code calls these functions anymore
--
-- These functions are replaced by on-chain contract interactions:
--   process_user_claim()        → ShelliesPoints.claim() / claimWithFees()
--   atomic_raffle_entry_wallet() → ShelliesPoints.spend() via RaffleContract.joinRaffle()
--   atomic_raffle_entry()       → same as above (older user_id-based variant)

DROP FUNCTION IF EXISTS process_user_claim(TEXT, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS process_user_claim(TEXT);
DROP FUNCTION IF EXISTS process_user_claim;

DROP FUNCTION IF EXISTS atomic_raffle_entry_wallet(TEXT, INTEGER, INTEGER, NUMERIC);
DROP FUNCTION IF EXISTS atomic_raffle_entry_wallet(TEXT, BIGINT, INTEGER, NUMERIC);
DROP FUNCTION IF EXISTS atomic_raffle_entry_wallet;

DROP FUNCTION IF EXISTS atomic_raffle_entry(UUID, INTEGER, INTEGER, NUMERIC);
DROP FUNCTION IF EXISTS atomic_raffle_entry(UUID, BIGINT, INTEGER, NUMERIC);
DROP FUNCTION IF EXISTS atomic_raffle_entry;
