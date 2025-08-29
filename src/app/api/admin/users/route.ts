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

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const { users, total } = await AdminService.getAllUsers(page, limit);
    
    return NextResponse.json({ users, total, page, limit });
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

    const { action, userId, blocked } = await request.json();

    switch (action) {
      case 'toggle_block':
        const success = await AdminService.toggleUserBlock(userId, blocked);
        if (!success) {
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