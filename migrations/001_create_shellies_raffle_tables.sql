-- Migration: Create Shellies Raffle Tables
-- Run this in your Supabase SQL Editor

-- Create shellies_raffle_users table
CREATE TABLE shellies_raffle_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet_address TEXT UNIQUE NOT NULL,
    points INTEGER DEFAULT 0,
    nft_count INTEGER DEFAULT 0,
    last_claim TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create shellies_raffle_raffles table
CREATE TABLE shellies_raffle_raffles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    points_per_ticket INTEGER NOT NULL DEFAULT 10,
    max_tickets_per_user INTEGER NOT NULL DEFAULT 5,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create shellies_raffle_entries table
CREATE TABLE shellies_raffle_entries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES shellies_raffle_users(id) ON DELETE CASCADE,
    raffle_id UUID REFERENCES shellies_raffle_raffles(id) ON DELETE CASCADE,
    ticket_count INTEGER NOT NULL DEFAULT 1,
    points_spent INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one entry per user per raffle
    UNIQUE(user_id, raffle_id)
);

-- Create indexes for better performance
CREATE INDEX idx_shellies_users_wallet_address ON shellies_raffle_users(wallet_address);
CREATE INDEX idx_shellies_users_points ON shellies_raffle_users(points DESC);
CREATE INDEX idx_shellies_raffles_active ON shellies_raffle_raffles(is_active, end_date);
CREATE INDEX idx_shellies_entries_user ON shellies_raffle_entries(user_id);
CREATE INDEX idx_shellies_entries_raffle ON shellies_raffle_entries(raffle_id);

-- Enable Row Level Security (RLS)
ALTER TABLE shellies_raffle_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE shellies_raffle_raffles ENABLE ROW LEVEL SECURITY;
ALTER TABLE shellies_raffle_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for shellies_raffle_users
CREATE POLICY "Allow read access to all users" ON shellies_raffle_users
    FOR SELECT USING (true);

CREATE POLICY "Allow users to update own data" ON shellies_raffle_users
    FOR UPDATE USING (wallet_address = current_setting('request.jwt.claim.address', true));

CREATE POLICY "Allow users to insert own data" ON shellies_raffle_users
    FOR INSERT WITH CHECK (wallet_address = current_setting('request.jwt.claim.address', true));

-- RLS Policies for shellies_raffle_raffles
CREATE POLICY "Allow read access to active raffles" ON shellies_raffle_raffles
    FOR SELECT USING (is_active = true);

-- RLS Policies for shellies_raffle_entries
CREATE POLICY "Allow read access to raffle entries" ON shellies_raffle_entries
    FOR SELECT USING (true);

CREATE POLICY "Allow users to insert own raffle entries" ON shellies_raffle_entries
    FOR INSERT WITH CHECK (
        user_id IN (
            SELECT id FROM shellies_raffle_users WHERE wallet_address = current_setting('request.jwt.claim.address', true)
        )
    );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at for users table
CREATE TRIGGER update_shellies_users_updated_at
    BEFORE UPDATE ON shellies_raffle_users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample raffles
INSERT INTO shellies_raffle_raffles (title, description, points_per_ticket, max_tickets_per_user, end_date, is_active)
VALUES 
    ('Rare Shellies NFT #1', 'Exclusive collectible with unique traits and special powers', 10, 5, '2024-12-31 23:59:59+00', true),
    ('Rare Shellies NFT #2', 'Limited edition artwork from the Genesis collection', 15, 3, '2024-12-31 23:59:59+00', true),
    ('Rare Shellies NFT #3', 'Special anniversary edition with golden shell', 20, 2, '2024-12-31 23:59:59+00', true),
    ('Mystery Shellies Box', 'Contains random rare NFTs and bonus points', 25, 1, '2024-12-31 23:59:59+00', true);