-- Get all participants for a specific raffle with their ticket counts and details
-- This function bypasses RLS and returns all entries regardless of any policies

CREATE OR REPLACE FUNCTION get_raffle_participants(
  p_raffle_id INTEGER
) RETURNS TABLE(
  wallet_address TEXT,
  ticket_count INTEGER,
  points_spent INTEGER,
  created_at TIMESTAMPTZ,
  join_tx_hash TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.wallet_address,
    e.ticket_count,
    e.points_spent,
    e.created_at,
    e.join_tx_hash
  FROM shellies_raffle_entries e
  WHERE e.raffle_id = p_raffle_id
  ORDER BY e.created_at DESC
  LIMIT 100000;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_raffle_participants(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_raffle_participants(INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION get_raffle_participants(INTEGER) TO service_role;

-- Add comment
COMMENT ON FUNCTION get_raffle_participants(INTEGER) IS 'Get all participants for a raffle with ticket details, bypassing RLS';
