import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Force dynamic rendering and disable caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

    // Fetch each NFT directly using the token instance API
    const nfts: Array<{
      tokenId: number;
      name?: string;
      image?: string;
      description?: string;
      attributes?: any[];
      metadata?: any;
    }> = [];

    // Fetch each token ID individually
    for (const tokenId of requestedTokenIds) {
      const apiUrl = `https://explorer.inkonchain.com/api/v2/tokens/${SHELLIES_CONTRACT_ADDRESS}/instances/${tokenId}`;

      let response: Response;
      let retryCount = 0;
      const maxRetries = 2;

      while (retryCount <= maxRetries) {
        try {
          response = await fetch(apiUrl, {
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'Shellies-App/1.0',
              'Cache-Control': 'no-cache, no-store, must-revalidate, proxy-revalidate, max-age=0',
              'Pragma': 'no-cache',
              'Expires': '0',
              'If-Modified-Since': 'Thu, 01 Jan 1970 00:00:00 GMT',
              'If-None-Match': '*'
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

          // If 404, the token doesn't exist - skip it
          if (response.status === 404) {
            console.warn(`Token ${tokenId} not found, skipping`);
            break;
          }

          throw new Error(`API request failed for token ${tokenId}: ${response.status} ${response.statusText}`);
        } catch (error) {
          if (retryCount === maxRetries) {
            console.error(`Failed to fetch token ${tokenId} after ${maxRetries} retries:`, error);
            break; // Skip this token and continue with others
          }
          retryCount++;
          await new Promise(resolve => setTimeout(resolve, 500 * retryCount));
        }
      }

      // If we successfully got a response, process the data
      if (response!.ok) {
        try {
          const tokenData = await response!.json();

          const rawImage = tokenData.image_url || tokenData.metadata?.image;
          const nftData = {
            tokenId,
            name: tokenData.metadata?.name || `Shellie #${tokenId}`,
            image: validateImageUrl(rawImage),
            description: tokenData.metadata?.description,
            attributes: tokenData.metadata?.attributes || [],
            metadata: tokenData.metadata
          };

          nfts.push(nftData);
        } catch (error) {
          console.error(`Failed to parse response for token ${tokenId}:`, error);
        }
      }
    }

    // Sort by token ID and return
    const sortedNfts = nfts.sort((a, b) => a.tokenId - b.tokenId);
    return NextResponse.json({ nfts: sortedNfts });
    
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