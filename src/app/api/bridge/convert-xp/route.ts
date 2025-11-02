import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ValidationError, NotFoundError, createErrorResponse, createSuccessResponse, ERROR_CODES } from '@/lib/errors';

// Create a service role client for atomic operations
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

// Request and response interfaces
interface ConvertXPRequest {
  walletAddress: string;
  xpAmount: number;
}

interface ConvertXPResponse {
  newXP: number;
  newPoints: number;
  pointsAdded: number;
}

// Conversion rate: 1000 XP = 100 points (divide by 10)
const CONVERSION_RATE = 10;

export async function POST(request: NextRequest) {
  try {
    // Step 1: Parse and validate request body
    const body: ConvertXPRequest = await request.json();
    const { walletAddress, xpAmount } = body;

    // Validate required fields
    if (!walletAddress || typeof walletAddress !== 'string') {
      throw new ValidationError(
        'Wallet address is required',
        ERROR_CODES.INVALID_REQUEST,
        400
      );
    }

    if (!xpAmount || typeof xpAmount !== 'number' || xpAmount <= 0) {
      throw new ValidationError(
        'XP amount must be a positive number',
        ERROR_CODES.INVALID_REQUEST,
        400
      );
    }

    // Validate XP amount is an integer
    if (!Number.isInteger(xpAmount)) {
      throw new ValidationError(
        'XP amount must be a whole number',
        ERROR_CODES.INVALID_REQUEST,
        400
      );
    }

    // Step 2: Query current user data
    const { data: user, error: fetchError } = await supabaseService
      .from('shellies_raffle_users')
      .select('wallet_address, game_score, points')
      .eq('wallet_address', walletAddress)
      .single();

    if (fetchError || !user) {
      console.error('User not found:', fetchError);
      throw new NotFoundError(
        'User not found',
        ERROR_CODES.USER_NOT_FOUND
      );
    }

    // Step 3: Verify user has sufficient game_score (XP)
    const currentXP = user.game_score || 0;
    if (currentXP < xpAmount) {
      throw new ValidationError(
        `Insufficient XP. You have ${currentXP} XP but need ${xpAmount} XP.`,
        'INSUFFICIENT_XP',
        400
      );
    }

    // Step 4: Calculate points to add
    const pointsAdded = xpAmount / CONVERSION_RATE;

    // Step 5: Execute atomic UPDATE query
    const { data: updatedUser, error: updateError } = await supabaseService
      .from('shellies_raffle_users')
      .update({
        game_score: currentXP - xpAmount,
        points: (user.points || 0) + pointsAdded,
        updated_at: new Date().toISOString()
      })
      .eq('wallet_address', walletAddress)
      .select('game_score, points')
      .single();

    if (updateError || !updatedUser) {
      console.error('Database error during conversion:', updateError);
      throw new ValidationError(
        'Failed to complete XP conversion',
        ERROR_CODES.DATABASE_ERROR,
        500
      );
    }

    // Step 6: Return updated balances
    const response: ConvertXPResponse = {
      newXP: updatedUser.game_score || 0,
      newPoints: updatedUser.points || 0,
      pointsAdded
    };

    return NextResponse.json(
      createSuccessResponse(
        `Successfully converted ${xpAmount} XP to ${pointsAdded} points!`,
        response
      )
    );

  } catch (error) {
    console.error('Error in XP conversion:', error);

    // Handle known validation errors
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      const errorResponse = createErrorResponse(error);
      return NextResponse.json(errorResponse, { status: error.statusCode });
    }

    // Handle unexpected errors
    const unexpectedError = new ValidationError(
      'An unexpected error occurred during XP conversion',
      ERROR_CODES.INTERNAL_ERROR,
      500
    );
    
    return NextResponse.json(
      createErrorResponse(unexpectedError), 
      { status: 500 }
    );
  }
}
