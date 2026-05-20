-- Migration 032: Add contract_address column to shellies_raffle_raffles
--
-- Why: After deploying the new (held-NFT-only) raffle contract, we keep a
-- mapping from each raffle row to the exact contract address that escrows
-- its prize. Without this, end/refund/payout would all be sent to the
-- current env address — which after the env flip is the NEW contract — and
-- would revert because the old contract still holds those raffles' prizes.
--
-- Backfill strategy:
--   * Rows where blockchain_deployed_at IS NOT NULL → already on-chain on
--     the old contract; fill with 0x5B8Ab35F6894130253bE7199F9eA66F5Dc63D956
--     (the address that NEXT_PUBLIC_RAFFLE_CONTRACT_ADDRESS pointed to at
--     the time this migration was authored).
--   * Rows where blockchain_deployed_at IS NULL → not yet on-chain;
--     leave NULL. The first successful deployment will write the value
--     (will be the new contract once env is flipped).
--
-- RUN ORDER:
--   1. Apply this migration BEFORE flipping NEXT_PUBLIC_RAFFLE_CONTRACT_ADDRESS
--      to the new contract.
--   2. Deploy the application code (multi-contract routing reads contract_address).
--   3. Deploy the new raffle contract.
--   4. Flip the env var to the new contract address.

ALTER TABLE shellies_raffle_raffles
  ADD COLUMN IF NOT EXISTS contract_address TEXT;

UPDATE shellies_raffle_raffles
SET contract_address = '0x5B8Ab35F6894130253bE7199F9eA66F5Dc63D956'
WHERE blockchain_deployed_at IS NOT NULL
  AND contract_address IS NULL;

CREATE INDEX IF NOT EXISTS idx_shellies_raffle_raffles_contract_address
  ON shellies_raffle_raffles (contract_address);
