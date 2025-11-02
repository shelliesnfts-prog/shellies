-- Rename game_sessions table to follow project naming convention
-- From: game_sessions
-- To: shellies_raffle_game_sessions

-- Drop existing policies first
DROP POLICY IF EXISTS "Users can view own game sessions" ON game_sessions;
DROP POLICY IF EXISTS "Service role can manage game sessions" ON game_sessions;

-- Drop existing indexes
DROP INDEX IF EXISTS idx_game_sessions_wallet_active;
DROP INDEX IF EXISTS idx_game_sessions_tx_hash;

-- Rename the table
ALTER TABLE game_sessions RENAME TO shellies_raffle_game_sessions;

-- Recreate indexes with new table name
CREATE INDEX IF NOT EXISTS idx_shellies_raffle_game_sessions_wallet_active 
    ON shellies_raffle_game_sessions(wallet_address, is_active, expires_at);

CREATE INDEX IF NOT EXISTS idx_shellies_raffle_game_sessions_tx_hash 
    ON shellies_raffle_game_sessions(transaction_hash);

-- Recreate RLS policies with new table name
CREATE POLICY "Users can view own game sessions"
    ON shellies_raffle_game_sessions
    FOR SELECT
    USING (wallet_address = current_setting('request.jwt.claims', true)::json->>'address');

CREATE POLICY "Service role can manage game sessions"
    ON shellies_raffle_game_sessions
    FOR ALL
    USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

-- Update comment
COMMENT ON TABLE shellies_raffle_game_sessions IS 'Tracks paid game sessions to prevent payment bypass exploits';
