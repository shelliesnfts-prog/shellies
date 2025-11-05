-- Migration: Create payment_tiers table for managing game payment pricing
-- This allows flexible pricing based on NFT ownership count

-- Create payment_tiers table
CREATE TABLE IF NOT EXISTS payment_tiers (
  id SERIAL PRIMARY KEY,
  tier_name VARCHAR(50) NOT NULL UNIQUE,
  payment_amount_wei VARCHAR(100) NOT NULL,
  min_nfts INTEGER NOT NULL DEFAULT 0,
  max_nfts INTEGER, -- NULL means no upper limit (infinity)
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT check_nft_range CHECK (min_nfts >= 0 AND (max_nfts IS NULL OR max_nfts >= min_nfts))
);

-- Insert default tiers with NFT count ranges
-- Regular users: 0 NFTs = 0.00001 ETH = 10000000000000 wei
-- Bronze: 1-4 NFTs = 0.000005 ETH = 5000000000000 wei (50% discount)
-- Silver: 5-9 NFTs = 0.000003 ETH = 3000000000000 wei (70% discount)
-- Gold: 10+ NFTs = 0.000002 ETH = 2000000000000 wei (80% discount)
INSERT INTO payment_tiers (tier_name, payment_amount_wei, min_nfts, max_nfts, description) VALUES
  ('regular', '10000000000000', 0, 0, 'Regular users without NFT'),
  ('bronze', '5000000000000', 1, 4, 'Bronze tier: 1-4 NFTs (50% discount)'),
  ('silver', '3000000000000', 5, 9, 'Silver tier: 5-9 NFTs (70% discount)'),
  ('gold', '2000000000000', 10, NULL, 'Gold tier: 10+ NFTs (80% discount)')
ON CONFLICT (tier_name) DO NOTHING;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_payment_tiers_active ON payment_tiers(is_active);
CREATE INDEX IF NOT EXISTS idx_payment_tiers_tier_name ON payment_tiers(tier_name);

-- Add RLS policies for security
ALTER TABLE payment_tiers ENABLE ROW LEVEL SECURITY;

-- Allow public read access to active tiers (for frontend to fetch pricing)
CREATE POLICY "Allow public read access to active payment tiers"
  ON payment_tiers
  FOR SELECT
  USING (is_active = true);

-- Note: Admin operations (INSERT, UPDATE, DELETE) are handled via API routes
-- with server-side authentication using service role key, so no RLS policies needed

-- Add comment for documentation
COMMENT ON TABLE payment_tiers IS 'Stores payment tier configuration for game entry fees. Allows different pricing based on NFT ownership count.';
COMMENT ON COLUMN payment_tiers.tier_name IS 'Unique identifier for the tier (e.g., regular, bronze, silver, gold)';
COMMENT ON COLUMN payment_tiers.payment_amount_wei IS 'Payment amount in wei (stored as string to handle large numbers)';
COMMENT ON COLUMN payment_tiers.min_nfts IS 'Minimum number of NFTs required for this tier (inclusive)';
COMMENT ON COLUMN payment_tiers.max_nfts IS 'Maximum number of NFTs for this tier (inclusive). NULL means no upper limit.';
COMMENT ON COLUMN payment_tiers.is_active IS 'Whether this tier is currently active and available';
