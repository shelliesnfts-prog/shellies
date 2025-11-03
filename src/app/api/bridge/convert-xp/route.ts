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

// Conversion cooldown: 7 days (in milliseconds)
const CONVERSION_COOLDOWN = 7 * 24 * 60 * 60 * 1000;

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

    // Step 2: Query current user data including last_convert
    const { data: user, error: fetchError } = await supabaseService
      .from('shellies_raffle_users')
      .select('wallet_address, game_score, points, last_convert')
      .eq('wallet_address', walletAddress)
      .single();

    if (fetchError || !user) {
      console.error('User not found:', fetchError);
      throw new NotFoundError(
        'User not found',
        ERROR_CODES.USER_NOT_FOUND
      );
    }

    // Step 2.5: Check if user can convert (7-day cooldown)
    if (user.last_convert) {
      const lastConvertTime = new Date(user.last_convert).getTime();
      const now = Date.now();
      const timeSinceLastConvert = now - lastConvertTime;

      if (timeSinceLastConvert < CONVERSION_COOLDOWN) {
        const secondsUntilNextConvert = Math.ceil((CONVERSION_COOLDOWN - timeSinceLastConvert) / 1000);
        const daysRemaining = Math.floor(secondsUntilNextConvert / (24 * 60 * 60));
        const hoursRemaining = Math.floor((secondsUntilNextConvert % (24 * 60 * 60)) / 3600);
        
        throw new ValidationError(
          `You can convert XP once per week. Next conversion available in ${daysRemaining}d ${hoursRemaining}h.`,
          'CONVERSION_COOLDOWN_ACTIVE',
          400
        );
      }
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

    // Step 5: Execute atomic UPDATE query with last_convert timestamp
    const now = new Date().toISOString();
    const { data: updatedUser, error: updateError } = await supabaseService
      .from('shellies_raffle_users')
      .update({
        game_score: currentXP - xpAmount,
        points: (user.points || 0) + pointsAdded,
        last_convert: now,
        updated_at: now
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


// GET endpoint to check conversion status without converting
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');

    if (!walletAddress) {
      throw new ValidationError(
        'Wallet address is required',
        ERROR_CODES.INVALID_REQUEST,
        400
      );
    }

    // Query user data
    const { data: user, error: fetchError } = await supabaseService
      .from('shellies_raffle_users')
      .select('wallet_address, game_score, points, last_convert')
      .eq('wallet_address', walletAddress)
      .single();

    if (fetchError || !user) {
      throw new NotFoundError(
        'User not found',
        ERROR_CODES.USER_NOT_FOUND
      );
    }

    // Calculate time until next conversion
    let canConvert = true;
    let secondsUntilNextConvert = 0;

    if (user.last_convert) {
      const lastConvertTime = new Date(user.last_convert).getTime();
      const now = Date.now();
      const timeSinceLastConvert = now - lastConvertTime;

      if (timeSinceLastConvert < CONVERSION_COOLDOWN) {
        canConvert = false;
        secondsUntilNextConvert = Math.ceil((CONVERSION_COOLDOWN - timeSinceLastConvert) / 1000);
      }
    }

    return NextResponse.json({
      canConvert,
      secondsUntilNextConvert,
      currentXP: user.game_score || 0,
      currentPoints: user.points || 0,
      lastConvert: user.last_convert || null
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
