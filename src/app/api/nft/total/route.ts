import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Force dynamic rendering and disable caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SHELLIES_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_SHELLIES_CONTRACT_ADDRESS?.toLowerCase();

/**
 * Validate if an address looks like a valid Ethereum address
 */
function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
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
    const bustCache = searchParams.get('bustCache') === 'true';

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
    let apiUrl = `https://explorer.inkonchain.com/api/v2/addresses/${walletAddress}/nft/collections?type=`;

    // Add cache-busting parameters when requested (less aggressive to avoid 422 errors)
    if (bustCache) {
      const timestamp = Date.now();
      apiUrl += `&_t=${timestamp}`;
    }

    let response: Response;
    let retryCount = 0;
    const maxRetries = 2;
    let currentApiUrl = apiUrl;
    let triedWithoutCacheBust = false;

    while (retryCount <= maxRetries) {
      try {
        const headers: Record<string, string> = {
          'Accept': 'application/json',
          'User-Agent': 'Shellies-App/1.0',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        };

        // Add more aggressive cache-busting headers when requested
        if (bustCache) {
          headers['Cache-Control'] = 'no-cache, no-store, must-revalidate, proxy-revalidate, max-age=0';
          headers['Pragma'] = 'no-cache';
          headers['Expires'] = '0';
          headers['If-Modified-Since'] = 'Thu, 01 Jan 1970 00:00:00 GMT';
          headers['If-None-Match'] = '*';
        }

        response = await fetch(currentApiUrl, {
          headers,
          cache: 'no-store',
          next: { revalidate: 0 }
        });

        if (response.ok) {
          break;
        }

        if (response.status === 429 && retryCount < maxRetries) {
          // Rate limited, wait and retry
          const delay = bustCache ? 2000 * (retryCount + 1) : 1000 * (retryCount + 1);
          await new Promise(resolve => setTimeout(resolve, delay));
          retryCount++;
          continue;
        }

        // If we get 422 with cache-busting, try without cache-busting
        if (response.status === 422 && bustCache && !triedWithoutCacheBust) {
          console.log('422 error with cache-busting, retrying without cache-busting parameters');
          currentApiUrl = `https://explorer.inkonchain.com/api/v2/addresses/${walletAddress}/nft/collections?type=`;
          triedWithoutCacheBust = true;
          // Don't increment retryCount for this fallback attempt
          continue;
        }

        // Log the response body for debugging 422 errors
        let errorDetails = '';
        try {
          const errorBody = await response.text();
          errorDetails = errorBody ? ` - Response: ${errorBody.substring(0, 200)}` : '';
        } catch (e) {
          // Ignore errors reading response body
        }

        throw new Error(`API request failed: ${response.status} ${response.statusText}${errorDetails}`);
      } catch (error) {
        if (retryCount === maxRetries) {
          throw error;
        }
        retryCount++;
        const delay = bustCache ? 1000 * retryCount : 500 * retryCount;
        await new Promise(resolve => setTimeout(resolve, delay));
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
        return NextResponse.json({ total: collection.amount });
      }
    }
    
    // Collection not found, return empty array
    return NextResponse.json({ total: 0 });
    
  } catch (error) {
    console.error('Error fetching total nfts:', error);

    // For 422 errors or other API failures, return empty array instead of 500 error
    // This allows the UI to still function, just with empty available NFTs
    if (error instanceof Error && error.message.includes('422')) {
      console.log('Returning 0 as total nfts due to API 422 error');
      return NextResponse.json({ total: 0 });
    }

    return NextResponse.json(
      {
        error: 'Failed to fetch total owned nfts data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}