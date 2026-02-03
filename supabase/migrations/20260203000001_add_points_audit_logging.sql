-- Migration: Add Comprehensive Points Audit Logging
-- This creates a complete audit trail for all point changes

-- Create audit table for point changes
CREATE TABLE IF NOT EXISTS shellies_points_audit (
  id BIGSERIAL PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  old_points NUMERIC NOT NULL,
  new_points NUMERIC NOT NULL,
  points_delta NUMERIC NOT NULL,
  change_reason TEXT NOT NULL, -- 'daily_claim', 'staking_claim', 'unified_claim', 'xp_conversion', 'admin_adjustment', 'raffle_entry'
  metadata JSONB, -- Additional context (e.g., NFT count, staking breakdown, tx hash)
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  changed_by TEXT -- API endpoint or admin user
);

-- Add indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_points_audit_wallet 
  ON shellies_points_audit(wallet_address);

CREATE INDEX IF NOT EXISTS idx_points_audit_date 
  ON shellies_points_audit(changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_points_audit_reason 
  ON shellies_points_audit(change_reason);

CREATE INDEX IF NOT EXISTS idx_points_audit_wallet_date 
  ON shellies_points_audit(wallet_address, changed_at DESC);

-- Create trigger function to automatically log point changes
CREATE OR REPLACE FUNCTION log_points_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if points actually changed
  IF OLD.points IS DISTINCT FROM NEW.points THEN
    INSERT INTO shellies_points_audit (
      wallet_address, 
      old_points, 
      new_points, 
      points_delta,
      change_reason,
      changed_by
    )
    VALUES (
      NEW.wallet_address,
      OLD.points,
      NEW.points,
      NEW.points - OLD.points,
      'auto_detected', -- Will be overridden by application if it sets a reason
      'database_trigger'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to shellies_raffle_users table
DROP TRIGGER IF EXISTS points_change_audit_trigger ON shellies_raffle_users;
CREATE TRIGGER points_change_audit_trigger
AFTER UPDATE ON shellies_raffle_users
FOR EACH ROW
EXECUTE FUNCTION log_points_change();

-- Create view for easy analysis of suspicious activity
CREATE OR REPLACE VIEW shellies_suspicious_point_changes AS
SELECT 
  wallet_address,
  points_delta,
  change_reason,
  metadata,
  changed_at,
  changed_by,
  CASE 
    WHEN points_delta > 10000 THEN 'CRITICAL - Extremely high gain (likely exploit)'
    WHEN points_delta > 5000 THEN 'HIGH - Very high gain (investigate)'
    WHEN points_delta > 3000 THEN 'HIGH - Above maximum reasonable'
    WHEN points_delta > 1000 THEN 'MEDIUM - High gain (review)'
    WHEN points_delta < -1000 THEN 'MEDIUM - Large loss'
    ELSE 'NORMAL'
  END as risk_level
FROM shellies_points_audit
WHERE ABS(points_delta) > 1000
ORDER BY changed_at DESC;

-- Create view for daily point gain summary
CREATE OR REPLACE VIEW shellies_daily_point_summary AS
SELECT 
  wallet_address,
  DATE(changed_at) as date,
  SUM(points_delta) as total_gained,
  COUNT(*) as num_changes,
  ARRAY_AGG(change_reason) as reasons,
  MAX(new_points) as final_points
FROM shellies_points_audit
WHERE points_delta > 0
GROUP BY wallet_address, DATE(changed_at)
ORDER BY date DESC, total_gained DESC;

-- Add comments
COMMENT ON TABLE shellies_points_audit IS 'Complete audit trail of all point changes for forensic analysis';
COMMENT ON COLUMN shellies_points_audit.points_delta IS 'Change in points (positive = gain, negative = loss)';
COMMENT ON COLUMN shellies_points_audit.change_reason IS 'Reason for point change (daily_claim, staking_claim, etc.)';
COMMENT ON COLUMN shellies_points_audit.metadata IS 'Additional context as JSON (NFT count, tx hash, etc.)';
COMMENT ON VIEW shellies_suspicious_point_changes IS 'View showing potentially suspicious point changes';
COMMENT ON VIEW shellies_daily_point_summary IS 'Daily summary of point gains per wallet';

-- Grant appropriate permissions (adjust as needed for your setup)
-- GRANT SELECT ON shellies_points_audit TO authenticated;
-- GRANT SELECT ON shellies_suspicious_point_changes TO authenticated;
-- GRANT SELECT ON shellies_daily_point_summary TO authenticated;
