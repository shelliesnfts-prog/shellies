-- Create function to get participant counts for multiple raffles
-- This counts distinct wallet addresses that have entries in each raffle

CREATE OR REPLACE FUNCTION get_raffle_participant_counts(
  p_raffle_ids UUID[]
) RETURNS TABLE(raffle_id UUID, participant_count INTEGER) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.raffle_id,
    COUNT(DISTINCT e.wallet_address)::INTEGER as participant_count
  FROM shellies_raffle_entries e
  WHERE e.raffle_id = ANY(p_raffle_ids)
  GROUP BY e.raffle_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_raffle_participant_counts(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION get_raffle_participant_counts(UUID[]) TO anon;

-- Add comment
COMMENT ON FUNCTION get_raffle_participant_counts(UUID[]) IS 'Get participant counts (distinct wallet addresses) for multiple raffles';