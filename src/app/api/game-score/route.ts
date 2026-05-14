import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, supabase } from '@/lib/supabase';
import { GameScoreUpdate } from '@/lib/types';

/**
 * SECURITY: Maximum reasonable score based on game mechanics
 * 
 * This value should be set based on your game's actual maximum achievable score.
 * For a typical endless runner/arcade game:
 * - Average session: 2-5 minutes
 * - Max reasonable session: 30 minutes (with exceptional skill)
 * - Score per second (typical): 10-50 points
 * - Max score = 30 min * 60 sec * 50 points = 90,000
 * 
 * We set to 10,000 as a reasonable max for typical gameplay.
 * Scores above this are flagged as suspicious.
 * Configure via environment variable for flexibility.
 */
const MAX_REASONABLE_SCORE = parseInt(process.env.MAX_GAME_SCORE || '10000', 10);

/**
 * SECURITY: Suspicious score threshold for logging
 * Scores above this but below max are logged for review
 */
const SUSPICIOUS_SCORE_THRESHOLD = Math.floor(MAX_REASONABLE_SCORE * 0.7); // 70% of max

// GET /api/game-score?walletAddress=...
// Retrieve user's best game score
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');

    if (!walletAddress) {
      return NextResponse.json(
        { success: false, error: 'walletAddress is required' },
        { status: 400 }
      );
    }

    const client = supabaseAdmin || supabase;

    // Query user's game score
    const { data, error } = await client
      .from('shellies_raffle_users')
      .select('game_score')
      .eq('wallet_address', walletAddress)
      .single();

    // If user doesn't exist, return 0
    if (error && error.code === 'PGRST116') {
      return NextResponse.json({
        success: true,
        game_score: 0
      });
    }

    if (error) {
      console.error('Error fetching game score:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch game score' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      game_score: data?.game_score || 0
    });
  } catch (error) {
    console.error('Unexpected error in GET /api/game-score:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/game-score
// Update user's game score (with session verification)
export async function POST(request: NextRequest) {
  try {
    const body: GameScoreUpdate = await request.json();
    const { score, walletAddress } = body;

    // SECURITY: Validate required fields
    if (!walletAddress || score === undefined || score === null) {
      return NextResponse.json(
        { success: false, error: 'score and walletAddress are required' },
        { status: 400 }
      );
    }

    // SECURITY: Validate score is a number and non-negative
    if (typeof score !== 'number' || score < 0) {
      return NextResponse.json(
        { success: false, error: 'score must be a non-negative number' },
        { status: 400 }
      );
    }

    // SECURITY: Validate score is an integer (no decimal manipulation)
    if (!Number.isInteger(score)) {
      return NextResponse.json(
        { success: false, error: 'score must be a whole number' },
        { status: 400 }
      );
    }

    // SECURITY: Log suspicious scores for review
    if (score > SUSPICIOUS_SCORE_THRESHOLD) {
      console.warn(`[SECURITY] Suspicious high score: ${score} from ${walletAddress} (threshold: ${SUSPICIOUS_SCORE_THRESHOLD})`);
    }

    // SECURITY: Validate maximum score to prevent manipulation
    if (score > MAX_REASONABLE_SCORE) {
      console.error(`[SECURITY] Score rejected - exceeds maximum: ${score} from ${walletAddress} (max: ${MAX_REASONABLE_SCORE})`);
      return NextResponse.json(
        { 
          success: false, 
          error: `Score ${score} exceeds maximum allowed score of ${MAX_REASONABLE_SCORE}. Please contact support if you believe this is an error.` 
        },
        { status: 400 }
      );
    }

    const client = supabaseAdmin || supabase;

    // SECURITY: CRITICAL - Verify user has an active game session before accepting score
    // This prevents users from submitting scores without paying
    const { data: gameSession, error: sessionError } = await client
      .from('shellies_raffle_game_sessions')
      .select('id, is_active, expires_at, transaction_hash')
      .eq('wallet_address', walletAddress.toLowerCase())
      .eq('is_active', true)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // SECURITY: REJECT if no active session found
    if (sessionError || !gameSession) {
      console.warn(`Score submission rejected - no active session for ${walletAddress}`);
      return NextResponse.json(
        { 
          success: false, 
          error: 'No active game session found. Please pay to play first.' 
        },
        { status: 403 }
      );
    }

    // SECURITY: Additional validation - ensure session has valid transaction hash
    if (!gameSession.transaction_hash || 
        gameSession.transaction_hash.length !== 66 ||
        !gameSession.transaction_hash.startsWith('0x')) {
      console.error(`Invalid transaction hash in session for ${walletAddress}: ${gameSession.transaction_hash}`);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid game session. Please create a new session with valid payment.' 
        },
        { status: 403 }
      );
    }

    // Try to call the update function first
    const { data: updateData, error: updateError } = await client
      .rpc('update_raffle_user_game_score', {
        user_wallet: walletAddress,
        new_score: score
      });

    // SECURITY FIX: ALWAYS invalidate game session after score submission to prevent reuse
    // This happens regardless of success/failure to prevent retry attacks
    await client
      .from('shellies_raffle_game_sessions')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', gameSession.id);

    // If function succeeds, return the result
    if (!updateError && updateData) {
      const updatedScore = Array.isArray(updateData) ? updateData[0]?.game_score : updateData.game_score;
      return NextResponse.json({
        success: true,
        game_score: updatedScore || score,
        isNewBest: true
      });
    }

    // If user doesn't exist, create them (but session is already invalidated above)
    if (updateError) {
      console.log('Update function failed, attempting to create user:', updateError.message);

      // First check if user exists
      const { data: existingUser } = await client
        .from('shellies_raffle_users')
        .select('wallet_address, game_score')
        .eq('wallet_address', walletAddress)
        .single();

      if (existingUser) {
        // User exists, update their score if new score is higher
        const currentScore = existingUser.game_score || 0;
        const newScore = Math.max(currentScore, score);

        const { error: directUpdateError } = await client
          .from('shellies_raffle_users')
          .update({
            game_score: newScore,
            updated_at: new Date().toISOString()
          })
          .eq('wallet_address', walletAddress);

        if (directUpdateError) {
          console.error('Error updating game score directly:', directUpdateError);
          return NextResponse.json(
            { success: false, error: 'Failed to update game score' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          game_score: newScore,
          isNewBest: newScore > currentScore
        });
      }

      // User doesn't exist, create new user
      const { data: newUser, error: createError } = await client
        .from('shellies_raffle_users')
        .insert([
          {
            wallet_address: walletAddress,
            points: 0,
            game_score: score
          }
        ])
        .select('game_score')
        .single();

      if (createError) {
        console.error('Error creating user:', createError);
        return NextResponse.json(
          { success: false, error: 'Failed to create user' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        game_score: newUser?.game_score || score,
        isNewBest: true
      });
    }

    return NextResponse.json({
      success: true,
      game_score: score,
      isNewBest: true
    });
  } catch (error) {
    console.error('Unexpected error in POST /api/game-score:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
