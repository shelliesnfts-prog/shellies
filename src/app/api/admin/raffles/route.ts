import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { AdminService } from '@/lib/admin-service';
import { RaffleContractService } from '@/lib/raffle-contract';

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
        
        // Validate prize data
        if (!raffleData.prize_token_address || !raffleData.prize_token_type) {
          return NextResponse.json({ error: 'Prize token information required' }, { status: 400 });
        }

        if (raffleData.prize_token_type === 'NFT' && !raffleData.prize_token_id) {
          return NextResponse.json({ error: 'NFT token ID required' }, { status: 400 });
        }

        if (raffleData.prize_token_type === 'ERC20' && !raffleData.prize_amount) {
          return NextResponse.json({ error: 'ERC20 amount required' }, { status: 400 });
        }
        
        // Step 1: Create raffle in database
        const newRaffle = await AdminService.createRaffle(raffleData);
        if (!newRaffle) {
          return NextResponse.json({ error: 'Failed to create raffle in database' }, { status: 500 });
        }

        // Step 2: Create raffle on blockchain
        try {
          const blockchainResult = await RaffleContractService.serverCreateAndActivateRaffle(
            newRaffle.id,
            raffleData.prize_token_address,
            raffleData.prize_token_type,
            raffleData.prize_token_id || null,
            raffleData.prize_amount || null,
            raffleData.end_date
          );

          if (!blockchainResult.success) {
            console.error('Blockchain transaction failed:', blockchainResult.error);
            
            // Rollback: Delete the raffle from database since blockchain failed
            const deleteSuccess = await AdminService.deleteRaffle(newRaffle.id.toString());
            if (!deleteSuccess) {
              console.error('Failed to rollback raffle from database after blockchain failure');
            }
            
            // Return error response
            return NextResponse.json({
              error: 'Failed to create raffle on blockchain',
              details: blockchainResult.error,
              rollbackStatus: deleteSuccess ? 'success' : 'failed'
            }, { status: 500 });
          }

          // Success - return raffle with blockchain transaction hashes
          return NextResponse.json({
            ...newRaffle,
            blockchainStatus: 'success',
            transactionHashes: blockchainResult.txHashes
          });

        } catch (error) {
          console.error('Error interacting with blockchain:', error);
          
          // Rollback: Delete the raffle from database since blockchain failed
          const deleteSuccess = await AdminService.deleteRaffle(newRaffle.id.toString());
          if (!deleteSuccess) {
            console.error('Failed to rollback raffle from database after blockchain error');
          }
          
          // Return error response
          return NextResponse.json({
            error: 'Blockchain interaction failed',
            details: error instanceof Error ? error.message : 'Unknown blockchain error',
            rollbackStatus: deleteSuccess ? 'success' : 'failed'
          }, { status: 500 });
        }

      case 'create_with_prize':
        if (!raffleData || !raffleData.prize) {
          return NextResponse.json({ error: 'Raffle data and prize required' }, { status: 400 });
        }
        
        // Create raffle in database first
        const newRaffleWithPrize = await AdminService.createRaffle(raffleData);
        if (!newRaffleWithPrize) {
          return NextResponse.json({ error: 'Failed to create raffle in database' }, { status: 500 });
        }

        // Return the raffle data with instructions to complete on frontend
        // The frontend will need to handle the contract interaction directly
        return NextResponse.json({ 
          raffle: newRaffleWithPrize,
          requiresContractDeposit: true,
          prize: raffleData.prize
        });

      case 'update':
        if (!raffleId || !raffleData) {
          return NextResponse.json({ error: 'Raffle ID and data required' }, { status: 400 });
        }
        
        const updateSuccess = await AdminService.updateRaffle(raffleId, raffleData);
        if (!updateSuccess) {
          return NextResponse.json({ error: 'Failed to update raffle' }, { status: 500 });
        }
        break;

      case 'end_early':
        if (!raffleId) {
          return NextResponse.json({ error: 'Raffle ID required' }, { status: 400 });
        }
        
        const endResult = await AdminService.endRaffleEarly(raffleId);
        if (!endResult.success) {
          return NextResponse.json({ error: endResult.error || 'Failed to end raffle' }, { status: 500 });
        }
        
        return NextResponse.json({ 
          success: true, 
          message: 'Raffle ended successfully',
          txHash: endResult.txHash 
        });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in admin raffles POST API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}