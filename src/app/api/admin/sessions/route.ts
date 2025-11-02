import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin, supabase } from '@/lib/supabase';

/**
 * Admin Sessions API
 * Manage game sessions - view all sessions and clean expired ones
 */

// GET /api/admin/sessions
// Fetch all game sessions with stats
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.address) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // TODO: Add admin check here
    // For now, any authenticated user can access

    const client = supabaseAdmin || supabase;

    // Fetch all sessions
    const { data: sessions, error } = await client
      .from('shellies_raffle_game_sessions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching sessions:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch sessions' },
        { status: 500 }
      );
    }

    // Calculate stats
    const now = new Date();
    const stats = {
      total: sessions.length,
      active: sessions.filter(s => s.is_active && new Date(s.expires_at) > now).length,
      expired: sessions.filter(s => new Date(s.expires_at) <= now).length,
      inactive: sessions.filter(s => !s.is_active).length,
    };

    return NextResponse.json({
      success: true,
      sessions,
      stats
    });
  } catch (error) {
    console.error('Unexpected error in GET /api/admin/sessions:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/sessions
// Clean expired and inactive sessions
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.address) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // TODO: Add admin check here
    // For now, any authenticated user can access

    const body = await request.json();
    const { action } = body;

    if (action !== 'clean_expired') {
      return NextResponse.json(
        { success: false, error: 'Invalid action' },
        { status: 400 }
      );
    }

    const client = supabaseAdmin || supabase;
    const now = new Date().toISOString();

    // Delete sessions that are either:
    // 1. Expired (expires_at < now)
    // 2. Inactive (is_active = false)
    const { data: deletedSessions, error } = await client
      .from('shellies_raffle_game_sessions')
      .delete()
      .or(`expires_at.lt.${now},is_active.eq.false`)
      .select();

    if (error) {
      console.error('Error cleaning sessions:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to clean sessions' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      deletedCount: deletedSessions?.length || 0,
      message: `Successfully cleaned ${deletedSessions?.length || 0} sessions`
    });
  } catch (error) {
    console.error('Unexpected error in DELETE /api/admin/sessions:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
