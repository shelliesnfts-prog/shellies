import { supabaseAdmin, supabase } from '@/lib/supabase';

/**
 * App Settings Service
 * Manages application-wide configurable settings stored in the database
 */

export interface AppSetting {
  key: string;
  value: string;
  description?: string;
  updated_at?: string;
  updated_by?: string;
}

// Default values for settings
const DEFAULT_SETTINGS: Record<string, string> = {
  xp_conversion_fee_usd: '0.1',
  xp_conversion_min_xp: '100',
  xp_conversion_rate: '10', // 1000 XP = 100 points (divide by 10)
};

export class AppSettingsService {
  private static client = supabaseAdmin || supabase;

  /**
   * Get a single setting by key
   */
  static async getSetting(key: string): Promise<string> {
    try {
      const { data, error } = await this.client
        .from('shellies_raffle_app_settings')
        .select('value')
        .eq('key', key)
        .single();

      if (error || !data) {
        console.warn(`Setting '${key}' not found, using default`);
        return DEFAULT_SETTINGS[key] || '';
      }

      return data.value;
    } catch (error) {
      console.error(`Error fetching setting '${key}':`, error);
      return DEFAULT_SETTINGS[key] || '';
    }
  }

  /**
   * Get multiple settings by keys
   */
  static async getSettings(keys: string[]): Promise<Record<string, string>> {
    try {
      const { data, error } = await this.client
        .from('shellies_raffle_app_settings')
        .select('key, value')
        .in('key', keys);

      if (error) {
        console.error('Error fetching settings:', error);
        // Return defaults for all requested keys
        return keys.reduce((acc, key) => {
          acc[key] = DEFAULT_SETTINGS[key] || '';
          return acc;
        }, {} as Record<string, string>);
      }

      // Build result with defaults for missing keys
      const result: Record<string, string> = {};
      for (const key of keys) {
        const found = data?.find(s => s.key === key);
        result[key] = found?.value || DEFAULT_SETTINGS[key] || '';
      }

      return result;
    } catch (error) {
      console.error('Error fetching settings:', error);
      return keys.reduce((acc, key) => {
        acc[key] = DEFAULT_SETTINGS[key] || '';
        return acc;
      }, {} as Record<string, string>);
    }
  }

  /**
   * Get all XP conversion related settings
   */
  static async getXPConversionSettings(): Promise<{
    feeUsd: number;
    minXp: number;
    conversionRate: number;
  }> {
    const settings = await this.getSettings([
      'xp_conversion_fee_usd',
      'xp_conversion_min_xp',
      'xp_conversion_rate',
    ]);

    return {
      feeUsd: parseFloat(settings.xp_conversion_fee_usd) || 0.1,
      minXp: parseInt(settings.xp_conversion_min_xp) || 100,
      conversionRate: parseInt(settings.xp_conversion_rate) || 10,
    };
  }

  /**
   * Update a setting (admin only - validation should be done at API level)
   */
  static async updateSetting(
    key: string,
    value: string,
    updatedBy: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.client
        .from('shellies_raffle_app_settings')
        .upsert({
          key,
          value,
          updated_at: new Date().toISOString(),
          updated_by: updatedBy,
        }, {
          onConflict: 'key',
        });

      if (error) {
        console.error('Error updating setting:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error updating setting:', error);
      return { success: false, error: 'Failed to update setting' };
    }
  }

  /**
   * Get all settings (for admin panel)
   */
  static async getAllSettings(): Promise<AppSetting[]> {
    try {
      const { data, error } = await this.client
        .from('shellies_raffle_app_settings')
        .select('*')
        .order('key');

      if (error) {
        console.error('Error fetching all settings:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching all settings:', error);
      return [];
    }
  }
}
