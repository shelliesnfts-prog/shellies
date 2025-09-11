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

    const requestBody = await request.json();
    const { action, raffleId, raffleData, isActive, txHash, txHashes, error: blockchainError, shouldDelete } = requestBody;

    switch (action) {
      case 'create':
        // Phase 3: Legacy server wallet method - DEPRECATED 
        // This method has been removed to enforce the new admin wallet approach
        
        return NextResponse.json({
          error: 'Server wallet raffle creation is deprecated and has been removed.',
          deprecated: true,
          migrate_to: 'create_admin_wallet',
          message: 'Please use the Admin Wallet deployment method for better security and control.',
          help: 'Switch to "Admin Wallet" in the deployment method selection.'
        }, { status: 410 }); // 410 Gone - method no longer available

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

      // ============ NEW ADMIN WALLET FLOW (PHASE 1) ============
      
      case 'create_admin_wallet':
        // Create raffle in database only, return raffle for client-side blockchain deployment
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
        
        // Create raffle in database with status 'CREATED' (not yet on blockchain)
        const adminRaffle = await AdminService.createRaffle({
          ...raffleData,
          status: 'CREATED' // Will be updated to ACTIVE after successful blockchain deployment
        });
        
        if (!adminRaffle) {
          return NextResponse.json({ error: 'Failed to create raffle in database' }, { status: 500 });
        }

        // Return raffle data for client-side blockchain deployment
        return NextResponse.json({
          success: true,
          raffle: adminRaffle,
          flow: 'admin_wallet',
          message: 'Raffle created in database. Ready for blockchain deployment.'
        });

      case 'mark_blockchain_deployed':
        // Mark raffle as successfully deployed on blockchain
        if (!raffleId) {
          return NextResponse.json({ error: 'Raffle ID required' }, { status: 400 });
        }
        
        // Update raffle status to ACTIVE and store transaction hashes
        const deployedUpdate = await AdminService.updateRaffle(raffleId, { 
          status: 'ACTIVE',
          blockchain_tx_hash: txHash || (txHashes && txHashes[0]) || null,
          blockchain_deployed_at: new Date().toISOString()
        });
        
        if (!deployedUpdate) {
          return NextResponse.json({ error: 'Failed to mark raffle as deployed' }, { status: 500 });
        }

        return NextResponse.json({ 
          success: true, 
          message: 'Raffle marked as deployed on blockchain',
          status: 'ACTIVE'
        });

      case 'mark_blockchain_failed':
        // Handle failed blockchain deployment
        if (!raffleId) {
          return NextResponse.json({ error: 'Raffle ID required' }, { status: 400 });
        }
        
        if (shouldDelete) {
          // Delete raffle from database if blockchain deployment failed
          const deleteSuccess = await AdminService.deleteRaffle(raffleId);
          if (!deleteSuccess) {
            console.error('Failed to delete raffle after blockchain failure');
            return NextResponse.json({ error: 'Failed to cleanup after blockchain failure' }, { status: 500 });
          }
          
          return NextResponse.json({ 
            success: true, 
            message: 'Raffle removed due to blockchain deployment failure',
            deleted: true
          });
        } else {
          // Mark as failed but keep in database for retry
          // Using CANCELLED status with blockchain_error flag until database enum is updated
          const failedUpdate = await AdminService.updateRaffle(raffleId, { 
            status: 'CANCELLED',
            blockchain_error: blockchainError || 'BLOCKCHAIN_DEPLOYMENT_FAILED',
            blockchain_failed_at: new Date().toISOString()
          });
          
          if (!failedUpdate) {
            return NextResponse.json({ error: 'Failed to mark raffle as blockchain failed' }, { status: 500 });
          }

          return NextResponse.json({ 
            success: true, 
            message: 'Raffle marked as blockchain deployment failed',
            status: 'CANCELLED' // Temporary until database enum is updated
          });
        }

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
        // Server-side end raffle using serverEndRaffle method
        if (!raffleId) {
          return NextResponse.json({ error: 'Raffle ID required' }, { status: 400 });
        }

        const endResult = await RaffleContractService.serverEndRaffle(raffleId);
        
        if (!endResult.success) {
          return NextResponse.json({ 
            error: endResult.error || 'Failed to end raffle',
            success: false 
          }, { status: 500 });
        }

        return NextResponse.json({ 
          success: true,
          message: 'Raffle ended successfully',
          txHash: endResult.txHash,
          status: 'COMPLETED'
        });

      case 'mark_raffle_ended':
        // Mark raffle as ended after successful admin wallet transaction
        if (!raffleId || !txHash) {
          return NextResponse.json({ error: 'Raffle ID and transaction hash required' }, { status: 400 });
        }
        
        // Update raffle status to COMPLETED with transaction hash
        const endedUpdate = await AdminService.updateRaffle(raffleId, { 
          status: 'COMPLETED',
          blockchain_tx_hash: txHash,
          end_date: new Date().toISOString()
        });
        
        if (!endedUpdate) {
          return NextResponse.json({ error: 'Failed to mark raffle as ended' }, { status: 500 });
        }

        return NextResponse.json({ 
          success: true, 
          message: 'Raffle marked as ended successfully',
          status: 'COMPLETED'
        });

      case 'prepare_admin_end':
        // Prepare data for admin wallet ending (fetch participants)
        if (!raffleId) {
          return NextResponse.json({ error: 'Raffle ID required' }, { status: 400 });
        }

        try {
          // Use the admin client to ensure we can read all data (bypass RLS)
          const { supabaseAdmin, supabase } = await import('@/lib/supabase');
          const client = supabaseAdmin || supabase;
          
          
          const { data: entries, error: entriesError } = await client
            .from('shellies_raffle_entries')
            .select('wallet_address, ticket_count')
            .eq('raffle_id', raffleId);


          if (entriesError) {
            console.error('❌ Database error fetching participants:', entriesError);
            return NextResponse.json({ 
              error: 'Failed to fetch participants',
              success: false 
            }, { status: 500 });
          }

          // Handle case where no participants joined - create empty arrays
          const entryData = entries || [];


          // Aggregate ticket counts by wallet address
          const participantMap = new Map<string, number>();
          entryData.forEach((entry: any) => {
            const current = participantMap.get(entry.wallet_address) || 0;
            participantMap.set(entry.wallet_address, current + entry.ticket_count);
          });

          const participants = Array.from(participantMap.keys());
          const ticketCounts = Array.from(participantMap.values());
          const totalTickets = ticketCounts.reduce((sum, count) => sum + count, 0);


          return NextResponse.json({ 
            success: true,
            participants,
            ticketCounts,
            totalParticipants: participants.length,
            totalTickets,
            raffleId: RaffleContractService.generateRaffleId(raffleId)
          });
        } catch (error) {
          console.error('Error preparing admin end:', error);
          return NextResponse.json({ 
            error: 'Failed to prepare raffle ending data',
            success: false 
          }, { status: 500 });
        }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in admin raffles POST API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}