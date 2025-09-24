import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { AdminService } from '@/lib/admin-service';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.address) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const isAdmin = await AdminService.isAdmin(session.address as string);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Extract pagination parameters from URL
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    
    // Validate pagination parameters
    const validPage = Math.max(1, page);
    const validLimit = Math.min(Math.max(1, limit), 100); // Cap at 100 items per page

    const { users, total } = await AdminService.getAllUsers(validPage, validLimit);
    
    return NextResponse.json({ users, total, page: validPage });
  } catch (error) {
    console.error('Error in admin users API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.address) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const isAdmin = await AdminService.isAdmin(session.address as string);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const { action, userId, blocked, points, status } = await request.json();

    switch (action) {
      case 'toggle_block':
        const success = await AdminService.toggleUserBlock(userId, blocked);
        if (!success) {
          return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
        }
        break;

      case 'update':
        const updateSuccess = await AdminService.updateUser(userId, { points, status });
        if (!updateSuccess) {
          return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
        }
        break;

      case 'delete':
        const deleteSuccess = await AdminService.deleteUser(userId);
        if (!deleteSuccess) {
          return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
        }
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in admin users POST API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}