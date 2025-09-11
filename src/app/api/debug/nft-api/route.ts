import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.address) {
      return NextResponse.json({ 
        error: 'Not authenticated' 
      }, { status: 401 });
    }

    const walletAddress = session.address as string;
    
    console.log('=== NFT API DEBUG ===');
    console.log(`Wallet Address: ${walletAddress}`);
    console.log(`Request URL: ${request.url}`);
    console.log(`Request Headers:`, Object.fromEntries(request.headers.entries()));
    
    // Test the exact same API call that NFTService makes
    const apiUrl = `https://explorer.inkonchain.com/api/v2/addresses/${walletAddress}/nft/collections?type=`;
    
    console.log(`Making API call to: ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Shellies-App/1.0'
      }
    });

    console.log(`API Response Status: ${response.status} ${response.statusText}`);
    console.log(`API Response Headers:`, Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API Error Response: ${errorText}`);
      return NextResponse.json({
        error: 'API request failed',
        status: response.status,
        statusText: response.statusText,
        errorText,
        requestUrl: apiUrl,
        requestHeaders: {
          'Accept': 'application/json',
          'User-Agent': 'Shellies-App/1.0'
        }
      }, { status: 500 });
    }

    const data = await response.json();
    
    console.log(`API Response Data:`, JSON.stringify(data, null, 2));
    
    // Analyze the response
    const shelliesContractAddress = process.env.NEXT_PUBLIC_SHELLIES_CONTRACT_ADDRESS?.toLowerCase();
    
    let shelliesCollection = null;
    let otherCollections = [];
    let totalNFTs = 0;
    
    if (data.items && Array.isArray(data.items)) {
      for (const collection of data.items) {
        totalNFTs += parseInt(collection.amount || '0', 10);
        
        if (collection.token?.address_hash?.toLowerCase() === shelliesContractAddress) {
          shelliesCollection = collection;
          console.log(`✅ Found Shellies collection:`, JSON.stringify(collection, null, 2));
        } else {
          otherCollections.push(collection);
          console.log(`🔍 Other collection found:`, {
            name: collection.token?.name,
            symbol: collection.token?.symbol,
            address: collection.token?.address_hash,
            amount: collection.amount
          });
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      walletAddress,
      requestUrl: apiUrl,
      apiResponse: data,
      analysis: {
        totalCollections: data.items?.length || 0,
        totalNFTs,
        shelliesContractAddress,
        hasShelliesCollection: !!shelliesCollection,
        shelliesCollection,
        otherCollections,
        shelliesTokenCount: shelliesCollection?.token_instances?.length || 0
      }
    });

  } catch (error) {
    console.error('Error in NFT API debug:', error);
    return NextResponse.json({ 
      error: 'Debug failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
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

    console.log('=== NFT API DEBUG (CUSTOM WALLET) ===');
    console.log(`Test Wallet: ${walletAddress}`);
    
    // Test the exact same API call that NFTService makes
    const apiUrl = `https://explorer.inkonchain.com/api/v2/addresses/${walletAddress}/nft/collections?type=`;
    
    console.log(`Making API call to: ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Shellies-App/1.0'
      }
    });

    console.log(`API Response Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API Error Response: ${errorText}`);
      return NextResponse.json({
        error: 'API request failed',
        status: response.status,
        statusText: response.statusText,
        errorText,
        requestUrl: apiUrl
      }, { status: 500 });
    }

    const data = await response.json();
    
    console.log(`API Response Data:`, JSON.stringify(data, null, 2));
    
    // Analyze the response
    const shelliesContractAddress = process.env.NEXT_PUBLIC_SHELLIES_CONTRACT_ADDRESS?.toLowerCase();
    
    let shelliesCollection = null;
    let otherCollections = [];
    let totalNFTs = 0;
    
    if (data.items && Array.isArray(data.items)) {
      for (const collection of data.items) {
        totalNFTs += parseInt(collection.amount || '0', 10);
        
        if (collection.token?.address_hash?.toLowerCase() === shelliesContractAddress) {
          shelliesCollection = collection;
        } else {
          otherCollections.push(collection);
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      walletAddress,
      requestUrl: apiUrl,
      apiResponse: data,
      analysis: {
        totalCollections: data.items?.length || 0,
        totalNFTs,
        shelliesContractAddress,
        hasShelliesCollection: !!shelliesCollection,
        shelliesCollection,
        otherCollections,
        shelliesTokenCount: shelliesCollection?.token_instances?.length || 0
      }
    });

  } catch (error) {
    console.error('Error in NFT API debug POST:', error);
    return NextResponse.json({ 
      error: 'Debug failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}