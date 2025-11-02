-- Create game_sessions table for server-side payment verification
-- This prevents users from bypassing payment by manipulating client-side code

CREATE TABLE IF NOT EXISTS game_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT NOT NULL,
    transaction_hash TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- Indexes for performance
    CONSTRAINT game_sessions_wallet_address_fkey 
        FOREIGN KEY (wallet_address) 
        REFERENCES shellies_raffle_users(wallet_address) 
        ON DELETE CASCADE
);

-- Index for fast lookups by wallet address and active status
CREATE INDEX IF NOT EXISTS idx_game_sessions_wallet_active 
    ON game_sessions(wallet_address, is_active, expires_at);

-- Index for transaction hash uniqueness check
CREATE INDEX IF NOT EXISTS idx_game_sessions_tx_hash 
    ON game_sessions(transaction_hash);

-- Add RLS policies
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;

-- Users can only read their own sessions
CREATE POLICY "Users can view own game sessions"
    ON game_sessions
    FOR SELECT
    USING (wallet_address = current_setting('request.jwt.claims', true)::json->>'address');

-- Only service role can insert/update/delete
CREATE POLICY "Service role can manage game sessions"
    ON game_sessions
    FOR ALL
    USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

-- Add comment
COMMENT ON TABLE game_sessions IS 'Tracks paid game sessions to prevent payment bypass exploits';
