-- Fix participant count function to use INTEGER raffle_id instead of UUID
-- This fixes the participant counting issue where the function expects UUID but raffles now use INTEGER IDs

-- Drop the old function
DROP FUNCTION IF EXISTS get_raffle_participant_counts(UUID[]);

-- Create updated function using INTEGER array
CREATE OR REPLACE FUNCTION get_raffle_participant_counts(
  p_raffle_ids INTEGER[]
) RETURNS TABLE(raffle_id INTEGER, participant_count INTEGER) AS $$
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
GRANT EXECUTE ON FUNCTION get_raffle_participant_counts(INTEGER[]) TO authenticated;
GRANT EXECUTE ON FUNCTION get_raffle_participant_counts(INTEGER[]) TO anon;

-- Add comment
COMMENT ON FUNCTION get_raffle_participant_counts(INTEGER[]) IS 'Get participant counts (distinct wallet addresses) for multiple raffles using INTEGER raffle_id';

-- Verify function creation
SELECT proname, proargtypes FROM pg_proc WHERE proname = 'get_raffle_participant_counts';