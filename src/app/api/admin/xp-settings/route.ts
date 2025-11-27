import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { AdminService } from '@/lib/admin-service';
import { AppSettingsService } from '@/lib/services/app-settings-service';

/**
 * GET /api/admin/xp-settings
 * Get XP conversion settings (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.address) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const isAdmin = await AdminService.isAdmin(session.address);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }

    const settings = await AppSettingsService.getXPConversionSettings();

    return NextResponse.json({
      success: true,
      settings: {
        feeUsd: settings.feeUsd,
        minXp: settings.minXp,
        conversionRate: settings.conversionRate,
      }
    });
  } catch (error) {
    console.error('Error fetching XP settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/xp-settings
 * Update XP conversion settings (admin only)
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.address) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const isAdmin = await AdminService.isAdmin(session.address);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { feeUsd, minXp, conversionRate } = body;

    const errors: string[] = [];

    // Validate and update fee
    if (feeUsd !== undefined) {
      const fee = parseFloat(feeUsd);
      if (isNaN(fee) || fee < 0.01 || fee > 100) {
        errors.push('Fee must be between 0.01 and 100 USD');
      } else {
        const result = await AppSettingsService.updateSetting(
          'xp_conversion_fee_usd',
          fee.toString(),
          session.address
        );
        if (!result.success) errors.push(result.error || 'Failed to update fee');
      }
    }

    // Validate and update min XP
    if (minXp !== undefined) {
      const min = parseInt(minXp);
      if (isNaN(min) || min < 1 || min > 100000) {
        errors.push('Minimum XP must be between 1 and 100,000');
      } else {
        const result = await AppSettingsService.updateSetting(
          'xp_conversion_min_xp',
          min.toString(),
          session.address
        );
        if (!result.success) errors.push(result.error || 'Failed to update min XP');
      }
    }

    // Validate and update conversion rate
    if (conversionRate !== undefined) {
      const rate = parseInt(conversionRate);
      if (isNaN(rate) || rate < 1 || rate > 1000) {
        errors.push('Conversion rate must be between 1 and 1000');
      } else {
        const result = await AppSettingsService.updateSetting(
          'xp_conversion_rate',
          rate.toString(),
          session.address
        );
        if (!result.success) errors.push(result.error || 'Failed to update rate');
      }
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { error: errors.join(', ') },
        { status: 400 }
      );
    }

    // Fetch updated settings
    const updatedSettings = await AppSettingsService.getXPConversionSettings();

    return NextResponse.json({
      success: true,
      message: 'Settings updated successfully',
      settings: updatedSettings
    });
  } catch (error) {
    console.error('Error updating XP settings:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
