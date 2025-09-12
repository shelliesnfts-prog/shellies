import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const SHELLIES_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_SHELLIES_CONTRACT_ADDRESS?.toLowerCase();

/**
 * Validate if an address looks like a valid Ethereum address
 */
function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validate and fix image URL
 */
function validateImageUrl(imageUrl: string | undefined): string | undefined {
  if (!imageUrl) return undefined;
  
  // Convert IPFS URLs to HTTP
  if (imageUrl.startsWith('ipfs://')) {
    const hash = imageUrl.replace('ipfs://', '');
    return `https://ipfs.io/ipfs/${hash}`;
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
 * API endpoint to get owned NFTs with metadata from Ink Explorer
 * This server-side proxy should provide more reliable and up-to-date data
 */
export async function GET(request: NextRequest) {
  try {
    // Get session to verify user is authenticated
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('address');

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
    }

    if (!isValidAddress(walletAddress)) {
      return NextResponse.json({ error: 'Invalid wallet address format' }, { status: 400 });
    }

    // Note: In a production environment, you may want to add additional access controls here
    // For now, we'll allow any authenticated user to query NFT data

    if (!SHELLIES_CONTRACT_ADDRESS) {
      return NextResponse.json({ error: 'Contract address not configured' }, { status: 500 });
    }

    // Fetch data from Ink Explorer API with cache busting and retry logic
    const apiUrl = `https://explorer.inkonchain.com/api/v2/addresses/${walletAddress}/nft/collections?type=`;
    
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
          // Disable Next.js caching for this external API call
          cache: 'no-store',
          // Add a random query param to bypass any CDN caching
          next: { revalidate: 0 }
        });

        if (response.ok) {
          break;
        }

        if (response.status === 429 && retryCount < maxRetries) {
          // Rate limited, wait and retry
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

    // Find our Shellies collection and extract all data
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
        
        // Sort by token ID and return
        const sortedNfts = nfts.sort((a, b) => a.tokenId - b.tokenId);
        return NextResponse.json({ nfts: sortedNfts });
      }
    }
    
    // Collection not found, return empty array
    return NextResponse.json({ nfts: [] });
    
  } catch (error) {
    console.error('Error fetching owned NFTs:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch NFT data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}