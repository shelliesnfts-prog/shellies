CREATE OR REPLACE FUNCTION deduct_xp_and_record_nonce(
    p_wallet      TEXT,
    p_xp_amount   INTEGER,
    p_nonce       BIGINT,
    p_expiry_ts   TIMESTAMPTZ
) RETURNS void AS $$
BEGIN
    -- Check sufficient XP
    IF (SELECT game_score FROM shellies_raffle_users
        WHERE wallet_address = p_wallet) < p_xp_amount THEN
        RAISE EXCEPTION 'Insufficient XP balance';
    END IF;

    -- Deduct XP
    UPDATE shellies_raffle_users
        SET game_score = game_score - p_xp_amount
        WHERE wallet_address = p_wallet;

    -- Record nonce
    INSERT INTO shellies_points_nonces (nonce, wallet, xp_amount, expiry)
        VALUES (p_nonce, p_wallet, p_xp_amount, p_expiry_ts);
END;
$$ LANGUAGE plpgsql;
