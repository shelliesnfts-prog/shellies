import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { supabase } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { authOptions } from '@/lib/auth';
import { RaffleValidationService } from '@/lib/services/raffleValidation';
import { ValidationError, AuthenticationError, createErrorResponse, createSuccessResponse } from '@/lib/errors';

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

interface EnterRaffleRequest {
  raffleId: string;
  ticketCount: number;
}

export async function POST(request: NextRequest) {
  try {
    // Step 1: Authentication check
    const session = await getServerSession(authOptions);
    if (!session?.address) {
      throw new AuthenticationError();
    }

    const walletAddress = session.address as string;
    console.log("==========> session wallet address:", walletAddress);
    
    // Step 2: Parse request body
    const body: EnterRaffleRequest = await request.json();
    const { raffleId, ticketCount } = body;

    // Step 3: Comprehensive application-level validation
    const validationResult = await RaffleValidationService.validateRaffleEntry(
      raffleId,
      ticketCount,
      walletAddress
    );

    // Step 4: Execute atomic database operation
    // Try new wallet-based function first, fall back to user_id based function
    let result, dbError;
    try {
      const { data, error } = await supabaseService.rpc('atomic_raffle_entry_wallet', {
        p_wallet_address: walletAddress,
        p_raffle_id: validationResult.raffle.id,
        p_ticket_count: ticketCount,
        p_points_to_deduct: validationResult.totalCost
      });
      result = data;
      dbError = error;
    } catch (error: any) {
      // If new function doesn't exist, use old function
      if (error.code === '42883') {
        const { data, error: oldError } = await supabaseService.rpc('atomic_raffle_entry', {
          p_user_id: validationResult.user.id,
          p_raffle_id: validationResult.raffle.id,
          p_ticket_count: ticketCount,
          p_points_to_deduct: validationResult.totalCost
        });
        result = data;
        dbError = oldError;
      } else {
        dbError = error;
      }
    }

    if (dbError) {
      console.error('Database error during atomic operation:', dbError);
      throw new ValidationError('Failed to complete raffle entry', 'DATABASE_ERROR', 500);
    }

    // Step 5: Return success response
    const successMessage = ticketCount === 1 
      ? `Successfully purchased 1 ticket for ${validationResult.raffle.title}!`
      : `Successfully purchased ${ticketCount} tickets for ${validationResult.raffle.title}!`;

    return NextResponse.json(createSuccessResponse(successMessage, result));

  } catch (error) {
    console.error('Error in raffle entry:', error);

    // Handle known validation errors
    if (error instanceof ValidationError) {
      const errorResponse = createErrorResponse(error);
      return NextResponse.json(errorResponse, { status: error.statusCode });
    }

    // Handle unexpected errors
    const unexpectedError = new ValidationError(
      'An unexpected error occurred',
      'INTERNAL_ERROR',
      500
    );
    
    return NextResponse.json(
      createErrorResponse(unexpectedError), 
      { status: 500 }
    );
  }
}