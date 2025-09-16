import { createPublicClient, http, erc721Abi } from 'viem';
import { defineChain } from 'viem';
import { ImageUtils } from './image-utils';

// Ink chain configuration (mainnet - correct endpoints)
const inkChain = defineChain({
  id: 57073,
  name: 'Ink',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://rpc-gel.inkonchain.com'],
      webSocket: ['wss://rpc-gel.inkonchain.com'],
    },
    public: {
      http: ['https://rpc-gel.inkonchain.com', 'https://rpc-qnd.inkonchain.com'],
      webSocket: ['wss://rpc-gel.inkonchain.com', 'wss://rpc-qnd.inkonchain.com'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Ink Explorer',
      url: 'https://explorer.inkonchain.com',
    },
  },
  testnet: false,
});

// Create Viem client for Ink blockchain with more conservative settings to avoid rate limits
const publicClient = createPublicClient({
  chain: inkChain,
  transport: http('https://rpc-qnd.inkonchain.com', {  // Use backup RPC first
    timeout: 3000,   // 3 seconds timeout (less aggressive)
    retryCount: 2,   // Allow more retries
    retryDelay: 1000 // Longer delay between retries
  })
});

// Backup client with primary RPC (with even more conservative settings)
const backupClient = createPublicClient({
  chain: inkChain,
  transport: http('https://rpc-gel.inkonchain.com', {
    timeout: 5000,   // 5 seconds timeout
    retryCount: 1,   // Single retry
    retryDelay: 2000 // 2 second delay
  })
});

// Use built-in viem ERC721 ABI (imported above)
// This includes all standard ERC721 functions plus common extensions

// Proxy contract ABI for detecting implementation
const proxyAbi = [
  {
    "inputs": [],
    "name": "implementation",
    "outputs": [{"internalType": "address", "name": "", "type": "address"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "admin", 
    "outputs": [{"internalType": "address", "name": "", "type": "address"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [{"internalType": "address", "name": "", "type": "address"}], 
    "stateMutability": "view",
    "type": "function"
  }
] as const;

// ERC165 interface IDs for detection
const ERC721_INTERFACE_ID = '0x80ac58cd';
const ERC721_ENUMERABLE_INTERFACE_ID = '0x780e9d63';

// Extended ERC721 ABI with enumerable functions
const erc721EnumerableAbi = [
  // Standard ERC721 functions
  {
    inputs: [{ name: 'owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    name: 'ownerOf',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function'
  },
  // ERC721Enumerable functions
  {
    inputs: [{ name: 'owner', type: 'address' }, { name: 'index', type: 'uint256' }],
    name: 'tokenOfOwnerByIndex',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'totalSupply',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'index', type: 'uint256' }],
    name: 'tokenByIndex',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  // ERC165
  {
    inputs: [{ name: 'interfaceId', type: 'bytes4' }],
    name: 'supportsInterface',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function'
  }
] as const;

export class NFTService {
  private static contractAddress: string = process.env.NEXT_PUBLIC_SHELLIES_CONTRACT_ADDRESS || '';

  /**
   * Get NFT count for a wallet address with rate limit handling
   * Always fetches fresh data from blockchain
   */
  static async getNFTCount(walletAddress: string): Promise<number> {
    try {
      // Validate inputs
      if (!this.contractAddress) {
        console.warn('Shellies contract address not configured');
        return 0;
      }

      if (!this.isValidAddress(walletAddress)) {
        console.warn(`Invalid wallet address format: ${walletAddress}`);
        return 0;
      }

      // Try primary client first, then backup client if rate limited
      let balance: bigint;
      try {
        balance = await publicClient.readContract({
          address: this.contractAddress as `0x${string}`,
          abi: erc721Abi,
          functionName: 'balanceOf',
          args: [walletAddress as `0x${string}`]
        });
      } catch (primaryError: any) {
        // Check if it's a rate limit error
        if (primaryError?.message?.includes('429') || primaryError?.message?.includes('Rate limit')) {

          // Add delay before trying backup
          await new Promise(resolve => setTimeout(resolve, 1000));

          balance = await backupClient.readContract({
            address: this.contractAddress as `0x${string}`,
            abi: erc721Abi,
            functionName: 'balanceOf',
            args: [walletAddress as `0x${string}`]
          });
        } else {
          throw primaryError;
        }
      }

      const nftCount = Number(balance);
      return nftCount;

    } catch (error) {
      console.error(`Error fetching NFT count for ${walletAddress}:`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        cause: error instanceof Error && error.cause instanceof Error ? error.cause.message : undefined,
        contractAddress: this.contractAddress
      });

      // If error occurred, return 0
      console.warn(`Error fetching NFT count, returning 0 for ${walletAddress}`);
      return 0;
    }
  }

  /**
   * Calculate points based on NFT count
   * Regular users (0 NFTs) = 1 point, NFT holders = 5 points per NFT
   */
  static calculateClaimPoints(nftCount: number): number {
    if (nftCount === 0) {
      return 1; // Regular users get 1 point
    }
    return nftCount * 5; // NFT holders get 5 points per NFT
  }

  /**
   * Calculate points for holders only (excludes regular user base point)
   * Used when user has staked NFTs to avoid double-counting
   */
  static calculateHolderOnlyPoints(nftCount: number): number {
    return nftCount * 5; // NFT holders get 5 points per NFT, no base point
  }

  /**
   * Calculate potential staking points (theoretical - for motivation)
   * Staked NFTs = 10 points per NFT
   */
  static calculateStakingPoints(nftCount: number): number {
    return nftCount * 10; // Each staked NFT gives 10 points
  }

  /**
   * Get tier information for a user
   */
  static getUserTierInfo(nftCount: number): {
    currentTier: 'Regular' | 'NFT Holder';
    currentPoints: number;
    nextTier: string | null;
    nextTierPoints: number | null;
    potentialStakingPoints: number | null;
  } {
    if (nftCount === 0) {
      return {
        currentTier: 'Regular',
        currentPoints: 1,
        nextTier: 'NFT Holder',
        nextTierPoints: 5,
        potentialStakingPoints: null
      };
    } else {
      return {
        currentTier: 'NFT Holder',
        currentPoints: nftCount * 5,
        nextTier: null,
        nextTierPoints: null,
        potentialStakingPoints: nftCount * 10
      };
    }
  }

  /**
   * Validate that the contract exists and has the balanceOf function
   */
  static async validateContract(): Promise<{ isValid: boolean; error?: string; info?: any }> {
    try {
      if (!this.contractAddress) {
        return { isValid: false, error: 'No contract address configured' };
      }

      // Check if there's code at the address
      const code = await publicClient.getBytecode({
        address: this.contractAddress as `0x${string}`
      });

      if (!code || code === '0x') {
        return { isValid: false, error: 'No contract found at address (not a contract)' };
      }

      // Check if it supports ERC721 interface
      try {
        const supportsInterfaceAbi = [
          {
            inputs: [{ name: 'interfaceId', type: 'bytes4' }],
            name: 'supportsInterface',
            outputs: [{ name: '', type: 'bool' }],
            stateMutability: 'view',
            type: 'function'
          }
        ] as const;

        const supportsERC721 = await publicClient.readContract({
          address: this.contractAddress as `0x${string}`,
          abi: supportsInterfaceAbi,
          functionName: 'supportsInterface',
          args: [ERC721_INTERFACE_ID as `0x${string}`]
        });

        if (supportsERC721) {
          return { 
            isValid: true, 
            info: { 
              hasERC721: true, 
              contractSize: code.length,
              interfaceSupport: 'ERC721'
            } 
          };
        }
      } catch (e) {
        // Contract does not support ERC165/supportsInterface
      }

      // Try a simple balanceOf call with zero address (should not fail with "function not found")
      try {
        await publicClient.readContract({
          address: this.contractAddress as `0x${string}`,
          abi: erc721Abi,
          functionName: 'balanceOf',
          args: ['0x0000000000000000000000000000000000000000' as `0x${string}`],
          blockTag: 'latest'
        });
        
        // If we get here without "function not found", the function exists
        return { 
          isValid: true, 
          info: { 
            hasBalanceOf: true, 
            contractSize: code.length,
            tested: 'zero address call succeeded'
          } 
        };
      } catch (error) {
        // Check if it's a revert (good) vs function not found (bad)
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('revert') || 
            errorMessage.includes('execution reverted') ||
            errorMessage.includes('invalid address') ||
            errorMessage.toLowerCase().includes('zero address')) {
          return { 
            isValid: true, 
            info: { 
              hasBalanceOf: true, 
              contractSize: code.length,
              tested: 'zero address reverted (expected)'
            } 
          };
        }
        
        return { 
          isValid: false, 
          error: `balanceOf function test failed: ${error instanceof Error ? error.message : String(error)}` 
        };
      }
    } catch (error) {
      return { isValid: false, error: `Validation failed: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  /**
   * Get contract info (for debugging/admin)
   */
  static async getContractInfo(): Promise<{ name?: string; symbol?: string; totalSupply?: number; validation: any } | null> {
    try {
      if (!this.contractAddress) {
        return null;
      }

      // First validate the contract
      const validation = await this.validateContract();
      
      if (!validation.isValid) {
        return { validation };
      }

      // Try to get contract metadata
      const results: any = { validation };

      try {
        const name = await publicClient.readContract({
          address: this.contractAddress as `0x${string}`,
          abi: erc721Abi,
          functionName: 'name'
        });
        results.name = name as string;
      } catch (e) {
        // Contract does not have name() function
      }

      try {
        const symbol = await publicClient.readContract({
          address: this.contractAddress as `0x${string}`,
          abi: erc721Abi,
          functionName: 'symbol'
        });
        results.symbol = symbol as string;
      } catch (e) {
        // Contract does not have symbol() function
      }

      try {
        const totalSupply = await publicClient.readContract({
          address: this.contractAddress as `0x${string}`,
          abi: erc721Abi,
          functionName: 'totalSupply'
        });
        results.totalSupply = Number(totalSupply);
      } catch (e) {
        // Contract does not have totalSupply() function
      }

      return results;
    } catch (error) {
      console.error('Error fetching contract info:', error);
      return { validation: { isValid: false, error: error instanceof Error ? error.message : String(error) } };
    }
  }


  /**
   * Get all NFT token IDs owned by a wallet address using our API endpoint
   * This uses a server-side proxy for more reliable data fetching
   */
  static async getOwnedTokenIds(walletAddress: string): Promise<number[]> {
    try {
      if (!this.contractAddress || !this.isValidAddress(walletAddress)) {
        return [];
      }


      // Use our API endpoint instead of direct explorer API call
      const apiUrl = `/api/nft/owned?address=${encodeURIComponent(walletAddress)}`;
      
      const response = await fetch(apiUrl + `&_t=${Date.now()}&_r=${Math.random()}`, {
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        // Disable caching to ensure fresh data
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      const ownedTokenIds = (data.nfts || []).map((nft: any) => nft.tokenId);
      const sortedTokenIds = ownedTokenIds.sort((a: number, b: number) => a - b);

      return sortedTokenIds;
      
    } catch (error) {
      console.error(`Failed to fetch NFTs for ${walletAddress}:`, error);

      // Fallback to direct explorer API call
      console.log('Attempting fallback to direct explorer API...');
      return await this.getOwnedTokenIdsFallback(walletAddress);
    }
  }

  /**
   * Fallback method for getting token IDs using direct explorer API
   */
  private static async getOwnedTokenIdsFallback(walletAddress: string): Promise<number[]> {
    try {
      const apiUrl = `https://explorer.inkonchain.com/api/v2/addresses/${walletAddress}/nft/collections?type=`;

      const response = await fetch(apiUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Shellies-App/1.0',
          'Cache-Control': 'no-cache'
        }
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.items || !Array.isArray(data.items)) {
        return [];
      }

      // Find our Shellies collection and extract token IDs
      const ownedTokenIds: number[] = [];

      for (const collection of data.items) {
        if (collection.token?.address_hash?.toLowerCase() === this.contractAddress.toLowerCase()) {
          if (collection.token_instances && Array.isArray(collection.token_instances)) {
            for (const instance of collection.token_instances) {
              if (instance.id) {
                ownedTokenIds.push(parseInt(instance.id, 10));
              }
            }
          }
          break; // Found our collection, no need to check others
        }
      }

      const sortedTokenIds = ownedTokenIds.sort((a, b) => a - b);

      return sortedTokenIds;
      
    } catch (error) {
      console.error(`Fallback token ID fetch also failed for ${walletAddress}:`, error);
      return [];
    }
  }

  /**
   * Get owned token IDs by analyzing Transfer events (fallback method)
   * Much more efficient than checking every token individually
   * Uses chunked queries to respect RPC limits
   */
  private static async getOwnedTokenIdsByEvents(walletAddress: string): Promise<number[]> {
    try {
      // Get current block number
      const currentBlock = await publicClient.getBlockNumber();
      const maxBlockRange = BigInt(8000); // Use 8000 blocks to stay under 10k limit
      const totalRangeToCheck = BigInt(50000); // Check last 50k blocks (~1 week)
      
      let allReceivedEvents: any[] = [];
      let allSentEvents: any[] = [];
      
      // Query events in chunks
      for (let i = BigInt(0); i < totalRangeToCheck; i += maxBlockRange) {
        const fromBlock = currentBlock - totalRangeToCheck + i;
        const toBlock = currentBlock - totalRangeToCheck + i + maxBlockRange - BigInt(1);
        
        // Don't go beyond current block
        const actualToBlock = toBlock > currentBlock ? currentBlock : toBlock;
        
        
        try {
          // Get received events for this chunk
          const receivedChunk = await this.callWithFallback(
            () => publicClient.getContractEvents({
              address: this.contractAddress as `0x${string}`,
              abi: erc721Abi,
              eventName: 'Transfer',
              args: {
                to: walletAddress as `0x${string}`
              },
              fromBlock,
              toBlock: actualToBlock
            }),
            () => backupClient.getContractEvents({
              address: this.contractAddress as `0x${string}`,
              abi: erc721Abi,
              eventName: 'Transfer',
              args: {
                to: walletAddress as `0x${string}`
              },
              fromBlock,
              toBlock: actualToBlock
            })
          );
          
          // Get sent events for this chunk
          const sentChunk = await this.callWithFallback(
            () => publicClient.getContractEvents({
              address: this.contractAddress as `0x${string}`,
              abi: erc721Abi,
              eventName: 'Transfer',
              args: {
                from: walletAddress as `0x${string}`
              },
              fromBlock,
              toBlock: actualToBlock
            }),
            () => backupClient.getContractEvents({
              address: this.contractAddress as `0x${string}`,
              abi: erc721Abi,
              eventName: 'Transfer',
              args: {
                from: walletAddress as `0x${string}`
              },
              fromBlock,
              toBlock: actualToBlock
            })
          );
          
          allReceivedEvents.push(...receivedChunk);
          allSentEvents.push(...sentChunk);
          
          // Add delay between chunks to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (chunkError) {
          console.warn(`Failed to query chunk ${fromBlock}-${actualToBlock}:`, chunkError);
          // Continue with other chunks
        }
        
        if (actualToBlock >= currentBlock) break;
      }

      // Calculate current ownership
      const receivedTokens = new Set(allReceivedEvents.map(event => Number(event.args.tokenId)));
      const sentTokens = new Set(allSentEvents.map(event => Number(event.args.tokenId)));
      
      // Tokens currently owned = received - sent
      const ownedTokens = [...receivedTokens].filter(tokenId => !sentTokens.has(tokenId));

      if (ownedTokens.length === 0) {
        return await this.getOwnedTokenIdsFallback(walletAddress);
      }

      // Verify ownership for tokens we think are owned (to handle edge cases)
      const verifiedTokens: number[] = [];
      const batchSize = 10; // Smaller batch size
      
      for (let i = 0; i < ownedTokens.length; i += batchSize) {
        const batch = ownedTokens.slice(i, i + batchSize);
        const verifications = await Promise.allSettled(
          batch.map(async (tokenId) => {
            try {
              const owner = await this.callWithFallback(
                () => publicClient.readContract({
                  address: this.contractAddress as `0x${string}`,
                  abi: erc721Abi,
                  functionName: 'ownerOf',
                  args: [BigInt(tokenId)]
                }),
                () => backupClient.readContract({
                  address: this.contractAddress as `0x${string}`,
                  abi: erc721Abi,
                  functionName: 'ownerOf',
                  args: [BigInt(tokenId)]
                })
              );
              return { tokenId, owner: owner as string };
            } catch (error) {
              return { tokenId, owner: null };
            }
          })
        );

        for (const result of verifications) {
          if (result.status === 'fulfilled' && 
              result.value.owner?.toLowerCase() === walletAddress.toLowerCase()) {
            verifiedTokens.push(result.value.tokenId);
          }
        }

        // Add delay between batches
        if (i + batchSize < ownedTokens.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      return verifiedTokens.sort((a, b) => a - b);
      
    } catch (error) {
      console.error('Event-based method failed, using fallback:', error);
      return await this.getOwnedTokenIdsFallback(walletAddress);
    }
  }


  /**
   * Check if the NFT contract supports ERC721Enumerable
   */
  static async supportsEnumerable(): Promise<boolean> {
    try {
      if (!this.contractAddress) return false;

      const supportsEnumerable = await publicClient.readContract({
        address: this.contractAddress as `0x${string}`,
        abi: erc721EnumerableAbi,
        functionName: 'supportsInterface',
        args: [ERC721_ENUMERABLE_INTERFACE_ID as `0x${string}`]
      });

      return supportsEnumerable as boolean;
    } catch (error) {
      return false;
    }
  }

  /**
   * Helper method to call primary function and fallback to backup on rate limit
   */
  static async callWithFallback<T>(
    primaryCall: () => Promise<T>,
    backupCall: () => Promise<T>
  ): Promise<T> {
    try {
      return await primaryCall();
    } catch (error: any) {
      if (error?.message?.includes('429') || error?.message?.includes('Rate limit')) {
        await new Promise(resolve => setTimeout(resolve, 500));
        return await backupCall();
      }
      throw error;
    }
  }

  /**
   * Get NFT token URI for a specific token
   */
  static async getTokenURI(tokenId: number): Promise<string | null> {
    try {
      if (!this.contractAddress) {
        return null;
      }

      const tokenURI = await this.callWithFallback(
        () => publicClient.readContract({
          address: this.contractAddress as `0x${string}`,
          abi: erc721Abi,
          functionName: 'tokenURI',
          args: [BigInt(tokenId)]
        }),
        () => backupClient.readContract({
          address: this.contractAddress as `0x${string}`,
          abi: erc721Abi,
          functionName: 'tokenURI',
          args: [BigInt(tokenId)]
        })
      );

      return tokenURI as string;
    } catch (error) {
      console.error(`Error getting token URI for token ${tokenId}:`, error);
      return null;
    }
  }

  /**
   * Validate and fix image URL using ImageUtils
   */
  static validateImageUrl(imageUrl: string | undefined): string | undefined {
    if (!imageUrl) return undefined;
    
    // Use ImageUtils for better IPFS handling
    if (imageUrl.startsWith('ipfs://')) {
      return ImageUtils.convertIpfsToHttp(imageUrl);
    }
    
    if (ImageUtils.isValidImageUrl(imageUrl)) {
      return imageUrl;
    }
    
    console.warn(`Invalid image URL: ${imageUrl}`);
    return undefined;
  }

  /**
   * Fetch NFT metadata from URI
   */
  static async fetchMetadata(tokenURI: string): Promise<{
    name?: string;
    image?: string;
    description?: string;
    attributes?: any[];
  } | null> {
    try {
      // Handle IPFS URLs
      let fetchURL = tokenURI;
      if (tokenURI.startsWith('ipfs://')) {
        fetchURL = ImageUtils.convertIpfsToHttp(tokenURI);
      }

      const response = await fetch(fetchURL);
      if (!response.ok) {
        throw new Error(`Failed to fetch metadata: ${response.status}`);
      }

      const metadata = await response.json();
      
      // Validate and fix image URL
      metadata.image = this.validateImageUrl(metadata.image);

      return metadata;
    } catch (error) {
      console.error(`Error fetching metadata from ${tokenURI}:`, error);
      return null;
    }
  }

  /**
   * Get metadata for specific staked NFTs from explorer API
   */
  static async getStakedNFTsMetadata(stakingContractAddress: string, tokenIds: number[]): Promise<Array<{
    tokenId: number;
    name?: string;
    image?: string;
    description?: string;
    attributes?: any[];
    metadata?: any;
  }>> {
    const maxRetries = 3;
    const retryDelay = 2000; // 2 seconds

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const apiUrl = `/api/nft/staked?stakingAddress=${encodeURIComponent(stakingContractAddress)}&tokenIds=${tokenIds.join(',')}`;

        const response = await fetch(apiUrl + `&_t=${Date.now()}&_r=${Math.random()}`, {
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          },
          cache: 'no-store'
        });

        if (!response.ok) {
          throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        if (data.error) {
          throw new Error(data.error);
        }

        const nfts = data.nfts || [];

        // If we got results OR this is the final attempt, return what we have
        if (nfts.length > 0 || attempt === maxRetries) {
          return nfts;
        }

        // If we expected data but got empty results, retry after delay (except on final attempt)
        if (tokenIds.length > 0 && nfts.length === 0 && attempt < maxRetries) {
          console.log(`Staked NFTs not found yet, retrying in ${retryDelay}ms (attempt ${attempt + 1}/${maxRetries + 1})...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }

        return nfts;

      } catch (error) {
        console.error(`Failed to fetch staked NFTs metadata (attempt ${attempt + 1}):`, error);

        // If this is the final attempt or a non-retryable error, return empty
        if (attempt === maxRetries) {
          return [];
        }

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }

    return [];
  }

  /**
   * Get comprehensive NFT data including metadata from API
   * Much faster than individual blockchain calls
   */
  static async getNFTMetadata(tokenId: number): Promise<{
    tokenId: number;
    name?: string;
    image?: string;
    description?: string;
    attributes?: any[];
  }> {
    try {
      // For now, we'll use a simple approach since the API data will be used in the staking page
      // The staking page will get all NFT data at once from the collections API
      return { tokenId, name: `Shellie #${tokenId}` };
    } catch (error) {
      console.error(`Error getting NFT metadata for token ${tokenId}:`, error);
      return { tokenId, name: `Shellie #${tokenId}` };
    }
  }

  /**
   * Get all NFT data with metadata using our API endpoint
   * This uses a server-side proxy for more reliable data fetching
   */
  static async getNFTsWithMetadata(walletAddress: string, bustCache: boolean = false): Promise<Array<{
    tokenId: number;
    name?: string;
    image?: string;
    description?: string;
    attributes?: any[];
    metadata?: any;
  }>> {
    try {
      if (!this.contractAddress || !this.isValidAddress(walletAddress)) {
        return [];
      }

      // Use our API endpoint instead of direct explorer API call
      let apiUrl = `/api/nft/owned?address=${encodeURIComponent(walletAddress)}`;
      if (bustCache) {
        apiUrl += `&bustCache=true`;
      }

      const response = await fetch(apiUrl + `&_t=${Date.now()}&_r=${Math.random()}`, {
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        // Disable caching to ensure fresh data
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      return data.nfts || [];
      
    } catch (error) {
      console.error(`Failed to fetch NFTs with metadata for ${walletAddress}:`, error);
      
      // Fallback to direct explorer API call if our endpoint fails
      console.log('Attempting fallback to direct explorer API...');
      return await this.getNFTsWithMetadataFallback(walletAddress);
    }
  }

  /**
   * Fallback method using direct explorer API call
   * Used when the main API endpoint fails
   */
  private static async getNFTsWithMetadataFallback(walletAddress: string): Promise<Array<{
    tokenId: number;
    name?: string;
    image?: string;
    description?: string;
    attributes?: any[];
    metadata?: any;
  }>> {
    try {
      const apiUrl = `https://explorer.inkonchain.com/api/v2/addresses/${walletAddress}/nft/collections?type=`;
      
      const response = await fetch(apiUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Shellies-App/1.0',
          'Cache-Control': 'no-cache'
        }
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.items || !Array.isArray(data.items)) {
        return [];
      }

      // Find our Shellies collection and extract all data
      for (const collection of data.items) {
        const collectionAddress = collection.token?.address_hash?.toLowerCase();
        if (collectionAddress === this.contractAddress.toLowerCase()) {
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
                  image: this.validateImageUrl(rawImage),
                  description: instance.metadata?.description,
                  attributes: instance.metadata?.attributes || [],
                  metadata: instance.metadata
                };
                
                nfts.push(nftData);
              }
            }
          }
          
          return nfts.sort((a, b) => a.tokenId - b.tokenId);
        }
      }
      
      return [];
      
    } catch (error) {
      console.error(`Fallback method also failed for ${walletAddress}:`, error);
      return [];
    }
  }

  /**
   * Check if NFT is approved for the staking contract
   */
  static async isNFTApproved(
    userAddress: string,
    stakingContractAddress: string,
    tokenId: number
  ): Promise<boolean> {
    try {
      if (!this.contractAddress) return false;


      const [approvedAddress, isApprovedForAll] = await Promise.all([
        this.callWithFallback(
          () => publicClient.readContract({
            address: this.contractAddress as `0x${string}`,
            abi: erc721Abi,
            functionName: 'getApproved',
            args: [BigInt(tokenId)],
          }),
          () => backupClient.readContract({
            address: this.contractAddress as `0x${string}`,
            abi: erc721Abi,
            functionName: 'getApproved',
            args: [BigInt(tokenId)],
          })
        ),
        this.callWithFallback(
          () => publicClient.readContract({
            address: this.contractAddress as `0x${string}`,
            abi: erc721Abi,
            functionName: 'isApprovedForAll',
            args: [userAddress as `0x${string}`, stakingContractAddress as `0x${string}`],
          }),
          () => backupClient.readContract({
            address: this.contractAddress as `0x${string}`,
            abi: erc721Abi,
            functionName: 'isApprovedForAll',
            args: [userAddress as `0x${string}`, stakingContractAddress as `0x${string}`],
          })
        )
      ]);

      const isApproved = (
        (approvedAddress as string).toLowerCase() === stakingContractAddress.toLowerCase() ||
        isApprovedForAll === true
      );

      return isApproved;
    } catch (error) {
      console.error(`Error checking NFT approval for token ${tokenId}:`, error);
      return false;
    }
  }

  /**
   * Check if all NFTs are approved for staking
   */
  static async checkNFTsApproval(
    userAddress: string,
    stakingContractAddress: string,
    tokenIds: number[]
  ): Promise<{ approved: number[]; needApproval: number[] }> {
    const approved: number[] = [];
    const needApproval: number[] = [];

    // First check if user has approved all NFTs at once
    try {
      const isApprovedForAll = await this.callWithFallback(
        () => publicClient.readContract({
          address: this.contractAddress as `0x${string}`,
          abi: erc721Abi,
          functionName: 'isApprovedForAll',
          args: [userAddress as `0x${string}`, stakingContractAddress as `0x${string}`],
        }),
        () => backupClient.readContract({
          address: this.contractAddress as `0x${string}`,
          abi: erc721Abi,
          functionName: 'isApprovedForAll',
          args: [userAddress as `0x${string}`, stakingContractAddress as `0x${string}`],
        })
      );

      if (isApprovedForAll) {
        return { approved: tokenIds, needApproval: [] };
      }
    } catch (error) {
      console.error('Error checking isApprovedForAll:', error);
    }

    // Check individual approvals
    for (const tokenId of tokenIds) {
      try {
        const isApproved = await this.isNFTApproved(userAddress, stakingContractAddress, tokenId);
        if (isApproved) {
          approved.push(tokenId);
        } else {
          needApproval.push(tokenId);
        }
        
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error checking approval for token ${tokenId}:`, error);
        needApproval.push(tokenId);
      }
    }

    return { approved, needApproval };
  }

  /**
   * Validate if an address looks like a valid Ethereum address
   */
  static isValidAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }
}

// Export contract address for use in other components
export const SHELLIES_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_SHELLIES_CONTRACT_ADDRESS || '';