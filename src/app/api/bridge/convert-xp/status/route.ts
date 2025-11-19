import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';
import { ValidationError, NotFoundError, createErrorResponse, ERROR_CODES } from '@/lib/errors';

// Create a service role client
const supabaseService = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

/**
 * GET endpoint to check conversion status
 * Used by frontend to check if pending conversion was already processed
 * 
 * Returns:
 * - lastConvert: Timestamp of last conversion
 * - currentXP: Current XP balance
 * - currentPoints: Current points balance
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user via session
    const session = await getServerSession(authOptions);
    
    if (!session?.address) {
      throw new ValidationError(
        'Not authenticated. Please connect your wallet.',
        ERROR_CODES.UNAUTHORIZED,
        401
      );
    }
    
    const walletAddress = session.address as string;
    
    // Get user's last_convert timestamp and balances
    const { data: user, error } = await supabaseService
      .from('shellies_raffle_users')
      .select('last_convert, game_score, points')
      .eq('wallet_address', walletAddress)
      .single();
    
    if (error || !user) {
      throw new NotFoundError(
        'User not found',
        ERROR_CODES.USER_NOT_FOUND
      );
    }
    
    return NextResponse.json({
      lastConvert: user.last_convert,
      currentXP: user.game_score || 0,
      currentPoints: user.points || 0
    });
    
  } catch (error) {
    console.error('Error checking conversion status:', error);
    
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      const errorResponse = createErrorResponse(error);
      return NextResponse.json(errorResponse, { status: error.statusCode });
    }
    
    const unexpectedError = new ValidationError(
      'An unexpected error occurred',
      ERROR_CODES.INTERNAL_ERROR,
      500
    );
    
    return NextResponse.json(
      createErrorResponse(unexpectedError),
      { status: 500 }
    );
  }
}
