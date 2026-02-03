-- Migration: Add Transaction Hash Deduplication
-- This prevents replay attacks by tracking all used transaction hashes

-- Create table to track used transaction hashes
CREATE TABLE IF NOT EXISTS shellies_used_transactions (
  tx_hash TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  endpoint TEXT NOT NULL,
  amount_usd NUMERIC,
  xp_converted INTEGER,
  points_gained NUMERIC
);

-- Add indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_used_tx_wallet 
  ON shellies_used_transactions(wallet_address);

CREATE INDEX IF NOT EXISTS idx_used_tx_date 
  ON shellies_used_transactions(used_at DESC);

CREATE INDEX IF NOT EXISTS idx_used_tx_endpoint 
  ON shellies_used_transactions(endpoint);

-- Add comments
COMMENT ON TABLE shellies_used_transactions IS 'Tracks all used transaction hashes to prevent replay attacks';
COMMENT ON COLUMN shellies_used_transactions.tx_hash IS 'Blockchain transaction hash (unique)';
COMMENT ON COLUMN shellies_used_transactions.wallet_address IS 'Wallet address that used this transaction';
COMMENT ON COLUMN shellies_used_transactions.endpoint IS 'API endpoint where transaction was used (e.g., convert-xp)';
COMMENT ON COLUMN shellies_used_transactions.amount_usd IS 'Payment amount in USD';
COMMENT ON COLUMN shellies_used_transactions.xp_converted IS 'Amount of XP converted (if applicable)';
COMMENT ON COLUMN shellies_used_transactions.points_gained IS 'Points gained from this transaction';
