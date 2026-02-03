import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';
import { ValidationError, NotFoundError, createErrorResponse, createSuccessResponse, ERROR_CODES } from '@/lib/errors';
import { verifyConversionPayment } from '@/lib/services/transaction-verification';
import { AppSettingsService } from '@/lib/services/app-settings-service';

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
  xpAmount: number;
  txHash: string;
}

interface ConvertXPResponse {
  newXP: number;
  newPoints: number;
  pointsAdded: number;
}

// Payment amount tolerance (20% to handle ETH price fluctuations)
const PAYMENT_TOLERANCE = 0.20; // 20%

export async function POST(request: NextRequest) {
  try {
    // STEP 1: Authenticate user via session
    const session = await getServerSession(authOptions);

    if (!session?.address) {
      throw new ValidationError(
        'Not authenticated. Please connect your wallet.',
        ERROR_CODES.NOT_AUTHENTICATED,
        401
      );
    }

    const authenticatedWallet = session.address as string;

    // STEP 2: Parse and validate request body
    const body: ConvertXPRequest = await request.json();
    const { txHash, xpAmount } = body;

    // Validate txHash
    if (!txHash || typeof txHash !== 'string') {
      throw new ValidationError(
        'Transaction hash is required',
        ERROR_CODES.INVALID_REQUEST,
        400
      );
    }

    // Validate XP amount
    if (!xpAmount || typeof xpAmount !== 'number' || xpAmount <= 0) {
      throw new ValidationError(
        'XP amount must be a positive number',
        ERROR_CODES.INVALID_REQUEST,
        400
      );
    }

    if (!Number.isInteger(xpAmount)) {
      throw new ValidationError(
        'XP amount must be a whole number',
        ERROR_CODES.INVALID_REQUEST,
        400
      );
    }

    // STEP 3: Fetch dynamic XP conversion settings
    const settings = await AppSettingsService.getXPConversionSettings();
    const conversionRate = settings.conversionRate;
    const expectedPaymentUsd = settings.feeUsd;
    const minimumXp = settings.minXp;

    // Calculate payment tolerance range
    const minPaymentUsd = expectedPaymentUsd * (1 - PAYMENT_TOLERANCE);
    const maxPaymentUsd = expectedPaymentUsd * (1 + PAYMENT_TOLERANCE);

    // STEP 4: SECURITY FIX - Atomic insert-first pattern to prevent race conditions
    // Insert transaction hash FIRST before any processing to claim it atomically
    // This prevents double-conversion when multiple requests arrive simultaneously
    const { error: insertError } = await supabaseService
      .from('shellies_used_transactions')
      .insert({
        tx_hash: txHash,
        wallet_address: authenticatedWallet,
        endpoint: 'convert-xp',
        amount_usd: 0, // Will be updated after verification
        xp_converted: 0, // Will be updated after success
        points_gained: 0 // Will be updated after success
      });

    // If insert fails due to unique constraint, transaction was already used
    if (insertError) {
      // Check if it's a unique violation (23505 is PostgreSQL unique constraint violation)
      if (insertError.code === '23505' || insertError.message?.includes('duplicate') || insertError.message?.includes('unique')) {
        throw new ValidationError(
          'This transaction has already been used for XP conversion.',
          'TRANSACTION_ALREADY_USED',
          400
        );
      }
      // For other errors, log and continue (table might not have unique constraint yet)
      console.warn('Error inserting transaction (non-critical):', insertError);
    }

    // STEP 5: Verify transaction on blockchain
    // This checks:
    // - Transaction exists and was successful
    // - Transaction sender = authenticatedWallet (CRITICAL!)
    // - Transaction recipient = payment contract
    const txData = await verifyConversionPayment(txHash, authenticatedWallet);

    if (!txData.isValid) {
      // Clean up the pre-inserted record since verification failed
      await supabaseService
        .from('shellies_used_transactions')
        .delete()
        .eq('tx_hash', txHash)
        .eq('wallet_address', authenticatedWallet);
        
      throw new ValidationError(
        'Invalid transaction. Please ensure you paid with your connected wallet to the correct contract.',
        'INVALID_TRANSACTION',
        400
      );
    }

    // STEP 6: Verify payment amount (with tolerance for ETH price fluctuations)
    if (txData.amountInUSD < minPaymentUsd || txData.amountInUSD > maxPaymentUsd) {
      // Clean up the pre-inserted record since verification failed
      await supabaseService
        .from('shellies_used_transactions')
        .delete()
        .eq('tx_hash', txHash)
        .eq('wallet_address', authenticatedWallet);
        
      throw new ValidationError(
        `Payment amount must be approximately ${expectedPaymentUsd} USD (received ${txData.amountInUSD.toFixed(4)} USD). Please pay the correct amount.`,
        'INVALID_PAYMENT_AMOUNT',
        400
      );
    }

    // STEP 7: Get user data
    const { data: user, error: fetchError } = await supabaseService
      .from('shellies_raffle_users')
      .select('wallet_address, game_score, points, last_convert')
      .eq('wallet_address', authenticatedWallet)
      .single();

    if (fetchError || !user) {
      console.error('User not found:', fetchError);
      throw new NotFoundError(
        'User not found',
        ERROR_CODES.USER_NOT_FOUND
      );
    }

    // STEP 8: Verify minimum XP requirement
    if (xpAmount < minimumXp) {
      throw new ValidationError(
        `Minimum ${minimumXp} XP required to convert.`,
        'INSUFFICIENT_XP',
        400
      );
    }

    // STEP 9: Verify sufficient XP
    const currentXP = user.game_score || 0;
    if (currentXP < xpAmount) {
      throw new ValidationError(
        `Insufficient XP. You have ${currentXP} XP but need ${xpAmount} XP.`,
        'INSUFFICIENT_XP',
        400
      );
    }

    // STEP 10: Check timestamp (prevent replay attacks)
    // NOTE: 7-day cooldown is REMOVED - users can convert anytime if they pay
    if (user.last_convert) {
      // IMPORTANT: Timezone-safe comparison
      // - Blockchain timestamp: Unix seconds (UTC)
      // - Database TIMESTAMPTZ: Stored as UTC internally
      // - .getTime(): Returns UTC milliseconds since epoch
      // - Both converted to UTC milliseconds for safe comparison

      const lastConvertTime = new Date(user.last_convert).getTime(); // UTC milliseconds
      const txTime = txData.timestamp * 1000; // Convert blockchain seconds to milliseconds

      // Only check if transaction is NEWER than last conversion (prevent replay)
      if (txTime <= lastConvertTime) {
        throw new ValidationError(
          'This transaction is older than your last conversion. Payment already used.',
          'PAYMENT_ALREADY_USED',
          400
        );
      }
      // NO 7-day cooldown check - payment is the rate limiter
    }

    // STEP 11: Calculate points using dynamic conversion rate
    const pointsAdded = xpAmount / conversionRate;

    // STEP 12: Execute conversion (atomic operation)
    const txTimestamp = new Date(txData.timestamp * 1000).toISOString();
    const now = new Date().toISOString();

    const { data: updatedUser, error: updateError } = await supabaseService
      .from('shellies_raffle_users')
      .update({
        game_score: currentXP - xpAmount,
        points: (user.points || 0) + pointsAdded,
        last_convert: txTimestamp, // Use blockchain timestamp (for replay prevention)
        updated_at: now
      })
      .eq('wallet_address', authenticatedWallet)
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

    // STEP 13: Update the pre-inserted transaction record with actual values
    // (Transaction was already claimed atomically in STEP 4)
    await supabaseService
      .from('shellies_used_transactions')
      .update({
        amount_usd: txData.amountInUSD,
        xp_converted: xpAmount,
        points_gained: pointsAdded
      })
      .eq('tx_hash', txHash)
      .eq('wallet_address', authenticatedWallet);

    // STEP 14: Return success
    return NextResponse.json(
      createSuccessResponse(
        `Successfully converted ${xpAmount} XP to ${pointsAdded} points!`,
        {
          newXP: updatedUser.game_score || 0,
          newPoints: updatedUser.points || 0,
          pointsAdded
        }
      )
    );

  } catch (error) {
    console.error('Error in XP conversion:', error);

    if (error instanceof ValidationError || error instanceof NotFoundError) {
      const errorResponse = createErrorResponse(error);
      return NextResponse.json(errorResponse, { status: error.statusCode });
    }

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


// GET endpoint removed - use /api/bridge/convert-xp/status instead
