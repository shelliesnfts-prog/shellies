-- Migration: Simplified atomic raffle entry function
-- This function performs only atomic operations, validation happens at application level

-- Drop the complex validation function
DROP FUNCTION IF EXISTS enter_raffle(UUID, TEXT, INTEGER);

-- Create simplified atomic function
CREATE OR REPLACE FUNCTION atomic_raffle_entry(
  p_user_id UUID,
  p_raffle_id UUID,
  p_ticket_count INTEGER,
  p_points_to_deduct INTEGER
) RETURNS JSON AS $$
DECLARE
  v_entry_id UUID;
  v_current_tickets INTEGER := 0;
  v_new_total_tickets INTEGER;
  v_remaining_points INTEGER;
BEGIN
  -- Get user's remaining points after deduction
  UPDATE shellies_raffle_users 
  SET points = points - p_points_to_deduct,
      updated_at = NOW()
  WHERE id = p_user_id
  RETURNING points INTO v_remaining_points;
  
  -- Get existing ticket count if entry exists
  SELECT ticket_count INTO v_current_tickets
  FROM shellies_raffle_entries
  WHERE user_id = p_user_id AND raffle_id = p_raffle_id;
  
  -- Calculate new total
  v_new_total_tickets := COALESCE(v_current_tickets, 0) + p_ticket_count;
  
  -- Insert or update raffle entry
  INSERT INTO shellies_raffle_entries (user_id, raffle_id, ticket_count, points_spent)
  VALUES (p_user_id, p_raffle_id, p_ticket_count, p_points_to_deduct)
  ON CONFLICT (user_id, raffle_id) 
  DO UPDATE SET
    ticket_count = shellies_raffle_entries.ticket_count + p_ticket_count,
    points_spent = shellies_raffle_entries.points_spent + p_points_to_deduct
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
GRANT EXECUTE ON FUNCTION atomic_raffle_entry(UUID, UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION atomic_raffle_entry(UUID, UUID, INTEGER, INTEGER) TO anon;

-- Add comment
COMMENT ON FUNCTION atomic_raffle_entry(UUID, UUID, INTEGER, INTEGER) IS 'Atomic raffle entry operation - validation happens at application level';

-- Verify function creation
SELECT proname, proargtypes FROM pg_proc WHERE proname = 'atomic_raffle_entry';