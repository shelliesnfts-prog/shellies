-- Migration: Simplified enter_raffle function
-- Run this SQL in your Supabase SQL Editor to create the enter_raffle function

-- Drop function if exists to ensure clean creation
DROP FUNCTION IF EXISTS enter_raffle(UUID, TEXT, INTEGER);

-- Create the enter_raffle function
CREATE OR REPLACE FUNCTION enter_raffle(
  p_raffle_id UUID,
  p_wallet_address TEXT,
  p_ticket_count INTEGER
) RETURNS JSON AS $$
DECLARE
  v_user_id UUID;
  v_user_points INTEGER;
  v_raffle_points_per_ticket INTEGER;
  v_raffle_max_tickets INTEGER;
  v_raffle_end_date TIMESTAMP WITH TIME ZONE;
  v_existing_tickets INTEGER := 0;
  v_total_cost INTEGER;
  v_new_total_tickets INTEGER;
  v_entry_id UUID;
  v_result JSON;
BEGIN
  -- Check if raffle exists and get its details
  SELECT points_per_ticket, max_tickets_per_user, end_date
  INTO v_raffle_points_per_ticket, v_raffle_max_tickets, v_raffle_end_date
  FROM shellies_raffle_raffles
  WHERE id = p_raffle_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'raffle_not_found';
  END IF;
  
  -- Check if raffle has ended
  IF v_raffle_end_date <= NOW() THEN
    RAISE EXCEPTION 'raffle_ended';
  END IF;
  
  -- Get user details
  SELECT id, points
  INTO v_user_id, v_user_points
  FROM shellies_raffle_users
  WHERE wallet_address = p_wallet_address;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;
  
  -- Calculate total cost
  v_total_cost := v_raffle_points_per_ticket * p_ticket_count;
  
  -- Check if user has enough points
  IF v_user_points < v_total_cost THEN
    RAISE EXCEPTION 'insufficient_points';
  END IF;
  
  -- Check existing entries for this user in this raffle
  SELECT ticket_count
  INTO v_existing_tickets
  FROM shellies_raffle_entries
  WHERE user_id = v_user_id AND raffle_id = p_raffle_id;
  
  -- If no existing entry found, set to 0
  IF v_existing_tickets IS NULL THEN
    v_existing_tickets := 0;
  END IF;
  
  -- Calculate new total tickets
  v_new_total_tickets := v_existing_tickets + p_ticket_count;
  
  -- Check if new total exceeds max tickets per user
  IF v_new_total_tickets > v_raffle_max_tickets THEN
    RAISE EXCEPTION 'max_tickets_exceeded';
  END IF;
  
  -- All validations passed, perform atomic operations
  
  -- Deduct points from user
  UPDATE shellies_raffle_users
  SET points = points - v_total_cost,
      updated_at = NOW()
  WHERE id = v_user_id;
  
  -- Insert or update raffle entry
  IF v_existing_tickets > 0 THEN
    -- Update existing entry
    UPDATE shellies_raffle_entries
    SET ticket_count = ticket_count + p_ticket_count,
        points_spent = points_spent + v_total_cost
    WHERE user_id = v_user_id AND raffle_id = p_raffle_id
    RETURNING id INTO v_entry_id;
  ELSE
    -- Insert new entry
    INSERT INTO shellies_raffle_entries (user_id, raffle_id, ticket_count, points_spent)
    VALUES (v_user_id, p_raffle_id, p_ticket_count, v_total_cost)
    RETURNING id INTO v_entry_id;
  END IF;
  
  -- Prepare success response
  v_result := json_build_object(
    'entry_id', v_entry_id,
    'tickets_purchased', p_ticket_count,
    'total_tickets', v_new_total_tickets,
    'points_spent', v_total_cost,
    'remaining_points', v_user_points - v_total_cost,
    'raffle_id', p_raffle_id
  );
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Re-raise the exception to be caught by the API
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission (this might vary based on your Supabase setup)
-- Try both of these grants:
GRANT EXECUTE ON FUNCTION enter_raffle(UUID, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION enter_raffle(UUID, TEXT, INTEGER) TO anon;

-- Add comment to document the function
COMMENT ON FUNCTION enter_raffle(UUID, TEXT, INTEGER) IS 'Atomically enters a user into a raffle with validation checks';

-- Test the function exists
SELECT proname, proargtypes FROM pg_proc WHERE proname = 'enter_raffle';