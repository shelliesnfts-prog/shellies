-- Create optimized function to get user ticket counts for multiple raffles
-- This will work with the current user_id schema and be backward compatible

-- Function for current schema (using user_id)
CREATE OR REPLACE FUNCTION get_user_raffle_tickets(
  p_wallet_address TEXT,
  p_raffle_ids UUID[]
) RETURNS TABLE(raffle_id UUID, total_tickets INTEGER) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.raffle_id,
    COALESCE(SUM(e.ticket_count)::INTEGER, 0) as total_tickets
  FROM shellies_raffle_entries e
  INNER JOIN shellies_raffle_users u ON u.id = e.user_id
  WHERE u.wallet_address = p_wallet_address
    AND e.raffle_id = ANY(p_raffle_ids)
  GROUP BY e.raffle_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function for new schema (using wallet_address directly)
CREATE OR REPLACE FUNCTION get_user_raffle_tickets_new(
  p_wallet_address TEXT,
  p_raffle_ids UUID[]
) RETURNS TABLE(raffle_id UUID, total_tickets INTEGER) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.raffle_id,
    COALESCE(SUM(e.ticket_count)::INTEGER, 0) as total_tickets
  FROM shellies_raffle_entries e
  WHERE e.wallet_address = p_wallet_address
    AND e.raffle_id = ANY(p_raffle_ids)
  GROUP BY e.raffle_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_user_raffle_tickets(TEXT, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_raffle_tickets(TEXT, UUID[]) TO anon;

GRANT EXECUTE ON FUNCTION get_user_raffle_tickets_new(TEXT, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_raffle_tickets_new(TEXT, UUID[]) TO anon;

-- Add comments
COMMENT ON FUNCTION get_user_raffle_tickets(TEXT, UUID[]) IS 'Get user ticket counts for multiple raffles using user_id join (current schema)';
COMMENT ON FUNCTION get_user_raffle_tickets_new(TEXT, UUID[]) IS 'Get user ticket counts for multiple raffles using wallet_address directly (new schema)';

-- Verify functions
SELECT proname, proargtypes FROM pg_proc WHERE proname IN ('get_user_raffle_tickets', 'get_user_raffle_tickets_new');