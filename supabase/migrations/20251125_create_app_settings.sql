-- Create shellies_raffle_app_settings table for storing configurable application settings
CREATE TABLE IF NOT EXISTS shellies_raffle_app_settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by VARCHAR(100)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_shellies_raffle_app_settings_key ON shellies_raffle_app_settings(key);

-- Insert default XP conversion settings
INSERT INTO shellies_raffle_app_settings (key, value, description) VALUES
  ('xp_conversion_fee_usd', '0.1', 'Fee in USD to convert XP to points'),
  ('xp_conversion_min_xp', '100', 'Minimum XP required to convert'),
  ('xp_conversion_rate', '10', 'XP per point ratio (e.g., 10 means 1000 XP = 100 points)')
ON CONFLICT (key) DO NOTHING;

-- Grant permissions (adjust based on your RLS policies)
ALTER TABLE shellies_raffle_app_settings ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role has full access to shellies_raffle_app_settings"
  ON shellies_raffle_app_settings
  FOR ALL
  USING (true)
  WITH CHECK (true);
