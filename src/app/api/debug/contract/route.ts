import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NFTService, SHELLIES_CONTRACT_ADDRESS } from '@/lib/nft-service';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.address) {
      return NextResponse.json({ 
        error: 'Not authenticated',
        contractAddress: SHELLIES_CONTRACT_ADDRESS,
        hasAddress: !!SHELLIES_CONTRACT_ADDRESS
      }, { status: 401 });
    }

    const walletAddress = session.address as string;
    
    console.log('=== CONTRACT DEBUG INFO ===');
    console.log(`Contract Address: ${SHELLIES_CONTRACT_ADDRESS}`);
    console.log(`User Wallet: ${walletAddress}`);
    
    // Get contract info and validation
    const contractInfo = await NFTService.getContractInfo();
    console.log('Contract Info:', JSON.stringify(contractInfo, null, 2));
    
    // NFT service no longer uses caching - always fetches fresh data
    
    // Try to get NFT count with detailed logging
    console.log('Attempting to get NFT count...');
    const nftCount = await NFTService.getNFTCount(walletAddress);
    console.log(`Final NFT Count: ${nftCount}`);
    
    return NextResponse.json({
      contractAddress: SHELLIES_CONTRACT_ADDRESS,
      userWallet: walletAddress,
      contractInfo,
      nftCount,
      cachingStatus: 'disabled - always fetches fresh data',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in contract debug:', error);
    return NextResponse.json({ 
      error: 'Debug failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      contractAddress: SHELLIES_CONTRACT_ADDRESS
    }, { status: 500 });
  }
}

// POST endpoint to test with a specific wallet address
export async function POST(request: NextRequest) {
  try {
    const { walletAddress } = await request.json();
    
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    console.log('=== CONTRACT DEBUG (CUSTOM WALLET) ===');
    console.log(`Contract Address: ${SHELLIES_CONTRACT_ADDRESS}`);
    console.log(`Test Wallet: ${walletAddress}`);
    
    // Validate address format
    if (!NFTService.isValidAddress(walletAddress)) {
      return NextResponse.json({ 
        error: 'Invalid address format',
        providedAddress: walletAddress
      }, { status: 400 });
    }
    
    // NFT service no longer uses caching
    
    // Get contract validation
    const validation = await NFTService.validateContract();
    console.log('Contract Validation:', JSON.stringify(validation, null, 2));
    
    // Try to get NFT count
    const nftCount = await NFTService.getNFTCount(walletAddress);
    console.log(`NFT Count for ${walletAddress}: ${nftCount}`);
    
    return NextResponse.json({
      contractAddress: SHELLIES_CONTRACT_ADDRESS,
      testWallet: walletAddress,
      validation,
      nftCount,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in contract debug POST:', error);
    return NextResponse.json({ 
      error: 'Debug failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}