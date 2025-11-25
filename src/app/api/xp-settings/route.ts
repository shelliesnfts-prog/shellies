import { NextRequest, NextResponse } from 'next/server';
import { AppSettingsService } from '@/lib/services/app-settings-service';

/**
 * GET /api/xp-settings
 * Public endpoint to get XP conversion settings for the frontend
 */
export async function GET(request: NextRequest) {
  try {
    const settings = await AppSettingsService.getXPConversionSettings();

    return NextResponse.json({
      feeUsd: settings.feeUsd,
      minXp: settings.minXp,
      conversionRate: settings.conversionRate,
    });
  } catch (error) {
    console.error('Error fetching XP settings:', error);
    // Return defaults on error
    return NextResponse.json({
      feeUsd: 0.1,
      minXp: 100,
      conversionRate: 10,
    });
  }
}
