import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin, supabase } from '@/lib/supabase';
import { verifyGamePayment } from '@/lib/services/transaction-verification';

/**
 * Game Session API
 * Validates payment and creates/verifies game sessions server-side
 * 
 * SECURITY: All game sessions require blockchain-verified payment
 */

// Expected game payment amount in USD (configure based on your pricing)
const EXPECTED_GAME_PAYMENT_USD = parseFloat(process.env.GAME_PAYMENT_AMOUNT_USD || '0.50');

interface GameSession {
  id: string;
  wallet_address: string;
  transaction_hash: string;
  created_at: string;
  expires_at: string;
  is_active: boolean;
}

// GET /api/game-session
// Verify if user has an active game session
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.address) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const walletAddress = session.address.toLowerCase();
    const client = supabaseAdmin || supabase;

    // Check for active game session
    const { data: gameSession, error } = await client
      .from('shellies_raffle_game_sessions')
      .select('*')
      .eq('wallet_address', walletAddress)
      .eq('is_active', true)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching game session:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch game session' },
        { status: 500 }
      );
    }

    if (!gameSession) {
      return NextResponse.json({
        success: true,
        hasActiveSession: false,
        session: null
      });
    }

    return NextResponse.json({
      success: true,
      hasActiveSession: true,
      session: {
        id: gameSession.id,
        transactionHash: gameSession.transaction_hash,
        expiresAt: gameSession.expires_at
      }
    });
  } catch (error) {
    console.error('Unexpected error in GET /api/game-session:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/game-session
// Create a new game session after payment verification
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.address) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { transactionHash } = body;

    if (!transactionHash) {
      return NextResponse.json(
        { success: false, error: 'Transaction hash is required' },
        { status: 400 }
      );
    }

    const walletAddress = session.address.toLowerCase();
    const client = supabaseAdmin || supabase;

    // Check if this transaction was already used
    const { data: existingSession } = await client
      .from('shellies_raffle_game_sessions')
      .select('id')
      .eq('transaction_hash', transactionHash)
      .single();

    if (existingSession) {
      return NextResponse.json(
        { success: false, error: 'Transaction already used for a game session' },
        { status: 400 }
      );
    }

    // SECURITY: Verify transaction on blockchain
    // This checks:
    // 1. Transaction exists and was successful
    // 2. Transaction is from the authenticated wallet
    // 3. Transaction is to the correct payment contract
    // 4. Transaction amount is approximately correct (with tolerance for ETH price fluctuations)
    const txVerification = await verifyGamePayment(
      transactionHash, 
      walletAddress,
      EXPECTED_GAME_PAYMENT_USD
    );

    if (!txVerification.isValid) {
      console.warn(`Game session rejected - invalid payment from ${walletAddress}:`, {
        transactionHash,
        verification: txVerification
      });
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid payment transaction. Please ensure you paid with your connected wallet to the correct contract.' 
        },
        { status: 400 }
      );
    }

    // SECURITY: Check if transaction is not too old (prevent using very old transactions)
    const txAge = Date.now() / 1000 - txVerification.timestamp;
    const maxTxAge = 3600; // 1 hour max
    if (txAge > maxTxAge) {
      console.warn(`Game session rejected - transaction too old from ${walletAddress}:`, {
        transactionHash,
        txAge,
        maxTxAge
      });
      return NextResponse.json(
        { 
          success: false, 
          error: 'Transaction is too old. Please make a new payment.' 
        },
        { status: 400 }
      );
    }

    // Ensure user exists in shellies_raffle_users table
    const { data: existingUser } = await client
      .from('shellies_raffle_users')
      .select('wallet_address')
      .eq('wallet_address', walletAddress)
      .single();

    if (!existingUser) {
      // Create user if they don't exist
      const { error: userCreateError } = await client
        .from('shellies_raffle_users')
        .insert([
          {
            wallet_address: walletAddress,
            points: 0,
            game_score: 0
          }
        ]);

      if (userCreateError) {
        console.error('Error creating user:', userCreateError);
        // Continue anyway - user might have been created by another request
      }
    }

    // Create new game session (expires after game over or 24 hours)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const { data: newSession, error: createError } = await client
      .from('shellies_raffle_game_sessions')
      .insert([
        {
          wallet_address: walletAddress,
          transaction_hash: transactionHash,
          expires_at: expiresAt.toISOString(),
          is_active: true
        }
      ])
      .select()
      .single();

    if (createError) {
      console.error('Error creating game session:', createError);
      return NextResponse.json(
        { success: false, error: 'Failed to create game session' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      session: {
        id: newSession.id,
        transactionHash: newSession.transaction_hash,
        expiresAt: newSession.expires_at
      }
    });
  } catch (error) {
    console.error('Unexpected error in POST /api/game-session:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/game-session
// End game session (called on game over)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.address) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const walletAddress = session.address.toLowerCase();
    const client = supabaseAdmin || supabase;

    // Deactivate all active sessions for this wallet
    const { error } = await client
      .from('shellies_raffle_game_sessions')
      .update({ is_active: false })
      .eq('wallet_address', walletAddress)
      .eq('is_active', true);

    if (error) {
      console.error('Error ending game session:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to end game session' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Game session ended'
    });
  } catch (error) {
    console.error('Unexpected error in DELETE /api/game-session:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
