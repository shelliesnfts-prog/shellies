import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const SHELLIES_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_SHELLIES_CONTRACT_ADDRESS?.toLowerCase();

/**
 * Validate and fix image URL
 */
function validateImageUrl(imageUrl: string | undefined): string | undefined {
  if (!imageUrl) return undefined;
  
  // Convert IPFS URLs to HTTP
  if (imageUrl.startsWith('ipfs://')) {
    const hash = imageUrl.replace('ipfs://', '');
    return `https://cloudflare-ipfs.com/ipfs/${hash}`;
  }
  
  // Check if it's a valid HTTP URL
  try {
    new URL(imageUrl);
    return imageUrl;
  } catch {
    console.warn(`Invalid image URL: ${imageUrl}`);
    return undefined;
  }
}

/**
 * API endpoint to get specific staked NFTs metadata from Ink Explorer
 */
export async function GET(request: NextRequest) {
  try {
    // Get session to verify user is authenticated
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const stakingAddress = searchParams.get('stakingAddress');
    const tokenIdsParam = searchParams.get('tokenIds');

    if (!stakingAddress) {
      return NextResponse.json({ error: 'Staking contract address is required' }, { status: 400 });
    }

    if (!tokenIdsParam) {
      return NextResponse.json({ error: 'Token IDs are required' }, { status: 400 });
    }

    if (!SHELLIES_CONTRACT_ADDRESS) {
      return NextResponse.json({ error: 'Contract address not configured' }, { status: 500 });
    }

    const requestedTokenIds = tokenIdsParam.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));
    
    if (requestedTokenIds.length === 0) {
      return NextResponse.json({ nfts: [] });
    }

    // Fetch data from Ink Explorer API for the staking contract
    const apiUrl = `https://explorer.inkonchain.com/api/v2/addresses/${stakingAddress}/nft/collections?type=`;
    
    let response: Response;
    let retryCount = 0;
    const maxRetries = 2;
    
    while (retryCount <= maxRetries) {
      try {
        response = await fetch(apiUrl, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Shellies-App/1.0',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          },
          cache: 'no-store',
          next: { revalidate: 0 }
        });

        if (response.ok) {
          break;
        }

        if (response.status === 429 && retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
          retryCount++;
          continue;
        }

        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      } catch (error) {
        if (retryCount === maxRetries) {
          throw error;
        }
        retryCount++;
        await new Promise(resolve => setTimeout(resolve, 500 * retryCount));
      }
    }

    const data = await response!.json();
    
    if (!data.items || !Array.isArray(data.items)) {
      return NextResponse.json({ nfts: [] });
    }

    // Find our Shellies collection and extract requested NFTs
    for (const collection of data.items) {
      const collectionAddress = collection.token?.address_hash?.toLowerCase();
      if (collectionAddress === SHELLIES_CONTRACT_ADDRESS) {
        const nfts: Array<{
          tokenId: number;
          name?: string;
          image?: string;
          description?: string;
          attributes?: any[];
          metadata?: any;
        }> = [];
        
        if (collection.token_instances && Array.isArray(collection.token_instances)) {
          for (const instance of collection.token_instances) {
            if (instance.id) {
              const tokenId = parseInt(instance.id, 10);
              
              // Only include NFTs that were requested
              if (requestedTokenIds.includes(tokenId)) {
                const rawImage = instance.image_url || instance.metadata?.image;
                const nftData = {
                  tokenId,
                  name: instance.metadata?.name || `Shellie #${tokenId}`,
                  image: validateImageUrl(rawImage),
                  description: instance.metadata?.description,
                  attributes: instance.metadata?.attributes || [],
                  metadata: instance.metadata
                };
                
                nfts.push(nftData);
              }
            }
          }
        }
        
        // Sort by token ID and return
        const sortedNfts = nfts.sort((a, b) => a.tokenId - b.tokenId);
        return NextResponse.json({ nfts: sortedNfts });
      }
    }
    
    // Collection not found, return empty array
    return NextResponse.json({ nfts: [] });
    
  } catch (error) {
    console.error('Error fetching staked NFTs:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch staked NFT data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}