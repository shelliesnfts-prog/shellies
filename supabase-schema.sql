-- Supabase database schema for Shellies Raffles

-- Users table to store user data and points
CREATE TABLE users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet_address TEXT UNIQUE NOT NULL,
    points INTEGER DEFAULT 0,
    nft_count INTEGER DEFAULT 0,
    last_claim TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Raffles table to store raffle information
CREATE TABLE raffles (
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

-- Raffle entries table to store user participation in raffles
CREATE TABLE raffle_entries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    raffle_id UUID REFERENCES raffles(id) ON DELETE CASCADE,
    ticket_count INTEGER NOT NULL DEFAULT 1,
    points_spent INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one entry per user per raffle
    UNIQUE(user_id, raffle_id)
);

-- Indexes for better performance
CREATE INDEX idx_users_wallet_address ON users(wallet_address);
CREATE INDEX idx_users_points ON users(points DESC);
CREATE INDEX idx_raffles_active ON raffles(is_active, end_date);
CREATE INDEX idx_raffle_entries_user ON raffle_entries(user_id);
CREATE INDEX idx_raffle_entries_raffle ON raffle_entries(raffle_id);

-- Row Level Security (RLS) policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE raffles ENABLE ROW LEVEL SECURITY;
ALTER TABLE raffle_entries ENABLE ROW LEVEL SECURITY;

-- Allow users to read all user data (for leaderboard)
CREATE POLICY "Allow read access to all users" ON users
    FOR SELECT USING (true);

-- Allow users to update their own data
CREATE POLICY "Allow users to update own data" ON users
    FOR UPDATE USING (wallet_address = current_setting('request.jwt.claim.address', true));

-- Allow users to insert their own data
CREATE POLICY "Allow users to insert own data" ON users
    FOR INSERT WITH CHECK (wallet_address = current_setting('request.jwt.claim.address', true));

-- Allow everyone to read active raffles
CREATE POLICY "Allow read access to active raffles" ON raffles
    FOR SELECT USING (is_active = true);

-- Allow users to read all raffle entries
CREATE POLICY "Allow read access to raffle entries" ON raffle_entries
    FOR SELECT USING (true);

-- Allow users to insert their own raffle entries
CREATE POLICY "Allow users to insert own raffle entries" ON raffle_entries
    FOR INSERT WITH CHECK (
        user_id IN (
            SELECT id FROM users WHERE wallet_address = current_setting('request.jwt.claim.address', true)
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

-- Trigger to automatically update updated_at
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert some sample raffles (optional)
INSERT INTO raffles (title, description, points_per_ticket, max_tickets_per_user, end_date, is_active)
VALUES 
    ('Rare Shellies NFT #1', 'Exclusive collectible with unique traits', 10, 5, '2024-12-31 23:59:59+00', true),
    ('Rare Shellies NFT #2', 'Limited edition artwork', 15, 3, '2024-12-31 23:59:59+00', true),
    ('Rare Shellies NFT #3', 'Special anniversary edition', 20, 2, '2024-12-31 23:59:59+00', true);