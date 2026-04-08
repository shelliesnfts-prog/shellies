CREATE TABLE shellies_points_nonces (
    nonce       BIGINT       PRIMARY KEY,
    wallet      TEXT         NOT NULL,
    xp_amount   INTEGER      NOT NULL,
    status      TEXT         NOT NULL DEFAULT 'pending', -- pending | completed | expired
    expiry      TIMESTAMPTZ  NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_nonces_wallet ON shellies_points_nonces (wallet);
CREATE INDEX idx_nonces_status ON shellies_points_nonces (status, expiry);
