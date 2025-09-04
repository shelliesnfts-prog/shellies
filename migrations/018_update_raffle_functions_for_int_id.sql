-- Update atomic raffle entry functions to use INTEGER raffle_id instead of UUID

-- First check what functions exist
SELECT proname, proargtypes, proargnames FROM pg_proc WHERE proname LIKE '%atomic_raffle%';

-- Drop any existing versions of the functions
DROP FUNCTION IF EXISTS atomic_raffle_entry_wallet(TEXT, UUID, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS atomic_raffle_entry(UUID, UUID, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS atomic_raffle_entry(UUID, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS atomic_raffle_entry_wallet(TEXT, INTEGER, INTEGER, INTEGER);

-- Create updated atomic function using INTEGER raffle_id
CREATE OR REPLACE FUNCTION atomic_raffle_entry_wallet(
  p_wallet_address TEXT,
  p_raffle_id INTEGER,
  p_ticket_count INTEGER,
  p_points_to_deduct INTEGER
) RETURNS JSON AS $$
DECLARE
  v_entry_id UUID;
  v_current_tickets INTEGER := 0;
  v_new_total_tickets INTEGER;
  v_remaining_points INTEGER;
BEGIN
  -- Update user points
  UPDATE shellies_raffle_users 
  SET points = points - p_points_to_deduct,
      updated_at = NOW()
  WHERE wallet_address = p_wallet_address
  RETURNING points INTO v_remaining_points;
  
  -- Get sum of existing tickets for this wallet and raffle
  SELECT COALESCE(SUM(ticket_count), 0) INTO v_current_tickets
  FROM shellies_raffle_entries
  WHERE wallet_address = p_wallet_address AND raffle_id = p_raffle_id;
  
  -- Calculate new total
  v_new_total_tickets := v_current_tickets + p_ticket_count;
  
  -- Insert new raffle entry (no conflict resolution since we allow multiple entries)
  INSERT INTO shellies_raffle_entries (wallet_address, raffle_id, ticket_count, points_spent)
  VALUES (p_wallet_address, p_raffle_id, p_ticket_count, p_points_to_deduct)
  RETURNING id INTO v_entry_id;
  
  -- Return success response with updated data
  RETURN json_build_object(
    'success', true,
    'entry_id', v_entry_id,
    'tickets_purchased', p_ticket_count,
    'total_tickets', v_new_total_tickets,
    'points_spent', p_points_to_deduct,
    'remaining_points', v_remaining_points,
    'raffle_id', p_raffle_id
  );
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log error and re-raise for application to handle
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the fallback function with INTEGER raffle_id

-- Create updated fallback atomic function using INTEGER raffle_id
CREATE OR REPLACE FUNCTION atomic_raffle_entry(
  p_user_id UUID,
  p_raffle_id INTEGER,
  p_ticket_count INTEGER,
  p_points_to_deduct INTEGER
) RETURNS JSON AS $$
DECLARE
  v_entry_id UUID;
  v_current_tickets INTEGER := 0;
  v_new_total_tickets INTEGER;
  v_remaining_points INTEGER;
BEGIN
  -- Update user points
  UPDATE shellies_raffle_users 
  SET points = points - p_points_to_deduct,
      updated_at = NOW()
  WHERE id = p_user_id
  RETURNING points INTO v_remaining_points;
  
  -- Get sum of existing tickets for this user and raffle
  SELECT COALESCE(SUM(ticket_count), 0) INTO v_current_tickets
  FROM shellies_raffle_entries
  WHERE user_id = p_user_id AND raffle_id = p_raffle_id;
  
  -- Calculate new total
  v_new_total_tickets := v_current_tickets + p_ticket_count;
  
  -- Insert new raffle entry (no conflict resolution since we allow multiple entries)
  INSERT INTO shellies_raffle_entries (user_id, raffle_id, ticket_count, points_spent)
  VALUES (p_user_id, p_raffle_id, p_ticket_count, p_points_to_deduct)
  RETURNING id INTO v_entry_id;
  
  -- Return success response with updated data
  RETURN json_build_object(
    'success', true,
    'entry_id', v_entry_id,
    'tickets_purchased', p_ticket_count,
    'total_tickets', v_new_total_tickets,
    'points_spent', p_points_to_deduct,
    'remaining_points', v_remaining_points,
    'raffle_id', p_raffle_id
  );
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log error and re-raise for application to handle
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION atomic_raffle_entry_wallet(TEXT, INTEGER, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION atomic_raffle_entry_wallet(TEXT, INTEGER, INTEGER, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION atomic_raffle_entry(UUID, INTEGER, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION atomic_raffle_entry(UUID, INTEGER, INTEGER, INTEGER) TO anon;

-- Add comments
COMMENT ON FUNCTION atomic_raffle_entry_wallet(TEXT, INTEGER, INTEGER, INTEGER) IS 'Atomic raffle entry operation using wallet_address with INTEGER raffle_id - validation happens at application level';
COMMENT ON FUNCTION atomic_raffle_entry(UUID, INTEGER, INTEGER, INTEGER) IS 'Atomic raffle entry operation using user_id with INTEGER raffle_id - validation happens at application level';

-- Verify function creation
SELECT proname, proargtypes FROM pg_proc WHERE proname IN ('atomic_raffle_entry_wallet', 'atomic_raffle_entry');