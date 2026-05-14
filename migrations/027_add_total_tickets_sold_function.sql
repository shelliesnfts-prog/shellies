-- Create function to efficiently calculate total tickets sold for multiple raffles
-- This groups by wallet_address first, then sums tickets to avoid counting duplicate entries

CREATE OR REPLACE FUNCTION get_raffle_total_tickets_sold(
  p_raffle_ids INTEGER[]
) RETURNS TABLE(raffle_id INTEGER, total_tickets BIGINT) AS $$
BEGIN
  RETURN QUERY
  WITH wallet_totals AS (
    -- First, sum tickets per wallet per raffle
    SELECT 
      e.raffle_id,
      e.wallet_address,
      SUM(e.ticket_count) as wallet_ticket_count
    FROM shellies_raffle_entries e
    WHERE e.raffle_id = ANY(p_raffle_ids)
    GROUP BY e.raffle_id, e.wallet_address
  )
  -- Then sum all wallet totals per raffle
  SELECT 
    wt.raffle_id,
    COALESCE(SUM(wt.wallet_ticket_count), 0)::BIGINT as total_tickets
  FROM wallet_totals wt
  GROUP BY wt.raffle_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_raffle_total_tickets_sold(INTEGER[]) TO authenticated;
GRANT EXECUTE ON FUNCTION get_raffle_total_tickets_sold(INTEGER[]) TO anon;

-- Add comment
COMMENT ON FUNCTION get_raffle_total_tickets_sold(INTEGER[]) IS 'Efficiently calculate total tickets sold for multiple raffles by grouping by wallet first';

-- Verify function creation
SELECT proname, proargtypes FROM pg_proc WHERE proname = 'get_raffle_total_tickets_sold';
