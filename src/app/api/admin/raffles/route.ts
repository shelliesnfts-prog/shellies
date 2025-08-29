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

    const raffles = await AdminService.getAllRaffles();
    
    return NextResponse.json(raffles);
  } catch (error) {
    console.error('Error in admin raffles API:', error);
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

    const { action, raffleId, raffleData, isActive } = await request.json();

    switch (action) {
      case 'create':
        if (!raffleData) {
          return NextResponse.json({ error: 'Raffle data required' }, { status: 400 });
        }
        
        const newRaffle = await AdminService.createRaffle(raffleData);
        if (!newRaffle) {
          return NextResponse.json({ error: 'Failed to create raffle' }, { status: 500 });
        }
        return NextResponse.json(newRaffle);

      case 'update':
        if (!raffleId || !raffleData) {
          return NextResponse.json({ error: 'Raffle ID and data required' }, { status: 400 });
        }
        
        const updateSuccess = await AdminService.updateRaffle(raffleId, raffleData);
        if (!updateSuccess) {
          return NextResponse.json({ error: 'Failed to update raffle' }, { status: 500 });
        }
        break;

      case 'toggle':
        if (!raffleId || typeof isActive !== 'boolean') {
          return NextResponse.json({ error: 'Raffle ID and active status required' }, { status: 400 });
        }
        
        const toggleSuccess = await AdminService.toggleRaffle(raffleId, isActive);
        if (!toggleSuccess) {
          return NextResponse.json({ error: 'Failed to toggle raffle' }, { status: 500 });
        }
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in admin raffles POST API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}