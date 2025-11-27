-- Migration: Simplify payment tiers to 3 static tiers
-- Regular users, NFT holders, and Stakers
-- Priority: Staker > NFT Holder > Regular

-- First, delete all existing tiers except 'regular'
DELETE FROM payment_tiers WHERE tier_name NOT IN ('regular');

-- Update regular tier to remove NFT range constraints
UPDATE payment_tiers 
SET 
  min_nfts = 0,
  max_nfts = NULL,
  description = 'Regular users without NFT or staking'
WHERE tier_name = 'regular';

-- Insert NFT holder tier
INSERT INTO payment_tiers (tier_name, payment_amount_wei, min_nfts, max_nfts, description) 
VALUES ('nft_holder', '5000000000000', 0, NULL, 'Users holding at least 1 NFT (50% discount)')
ON CONFLICT (tier_name) DO UPDATE SET
  payment_amount_wei = EXCLUDED.payment_amount_wei,
  min_nfts = EXCLUDED.min_nfts,
  max_nfts = EXCLUDED.max_nfts,
  description = EXCLUDED.description,
  is_active = true;

-- Insert staker tier (highest priority)
INSERT INTO payment_tiers (tier_name, payment_amount_wei, min_nfts, max_nfts, description) 
VALUES ('staker', '2000000000000', 0, NULL, 'Users with staked NFTs (80% discount)')
ON CONFLICT (tier_name) DO UPDATE SET
  payment_amount_wei = EXCLUDED.payment_amount_wei,
  min_nfts = EXCLUDED.min_nfts,
  max_nfts = EXCLUDED.max_nfts,
  description = EXCLUDED.description,
  is_active = true;

-- Add comment for documentation
COMMENT ON TABLE payment_tiers IS 'Stores 3 static payment tiers: regular, nft_holder, staker. Priority: staker > nft_holder > regular. Only one NFT or stake needed to unlock tier.';
