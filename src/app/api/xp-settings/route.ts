import { NextRequest, NextResponse } from 'next/server';
import { AppSettingsService } from '@/lib/services/app-settings-service';

const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=600',
};

const ERROR_CACHE_HEADERS = {
  'Cache-Control': 'no-store',
};

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
    }, { headers: CACHE_HEADERS });
  } catch (error) {
    console.error('Error fetching XP settings:', error);
    // Return defaults on error
    return NextResponse.json({
      feeUsd: 0.1,
      minXp: 100,
      conversionRate: 10,
    }, { headers: ERROR_CACHE_HEADERS });
  }
}
