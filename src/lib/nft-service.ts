import { createPublicClient, http, erc721Abi } from 'viem';
import { defineChain } from 'viem';

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
  
  // Cache for NFT counts (2 hour cache for better performance)
  private static nftCache = new Map<string, { count: number; timestamp: number; }>();
  private static readonly CACHE_DURATION = 2 * 60 * 60 * 1000; // 2 hours (reduced blockchain calls)

  /**
   * Get NFT count for a wallet address with rate limit handling
   * Uses caching to prevent excessive RPC calls and tries multiple RPC endpoints
   */
  static async getNFTCount(walletAddress: string): Promise<number> {
    try {
      // Check cache first
      const cached = this.nftCache.get(walletAddress.toLowerCase());
      const now = Date.now();
      
      if (cached && (now - cached.timestamp) < this.CACHE_DURATION) {
        console.log(`NFT count cache hit for ${walletAddress}: ${cached.count}`);
        return cached.count;
      }

      // Validate inputs
      if (!this.contractAddress) {
        console.warn('Shellies contract address not configured');
        return 0;
      }

      if (!this.isValidAddress(walletAddress)) {
        console.warn(`Invalid wallet address format: ${walletAddress}`);
        return 0;
      }

      console.log(`Fetching NFT count for ${walletAddress} from contract ${this.contractAddress}`);

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
          console.log('Primary RPC rate limited, trying backup RPC...');
          
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
      
      // Cache the successful result
      this.nftCache.set(walletAddress.toLowerCase(), {
        count: nftCount,
        timestamp: now
      });

      console.log(`Successfully fetched NFT count for ${walletAddress}: ${nftCount}`);
      return nftCount;

    } catch (error) {
      console.error(`Error fetching NFT count for ${walletAddress}:`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        cause: error instanceof Error && error.cause instanceof Error ? error.cause.message : undefined,
        contractAddress: this.contractAddress
      });

      // Return cached value if available, even if expired
      const cached = this.nftCache.get(walletAddress.toLowerCase());
      if (cached) {
        console.log(`Using expired cache due to error for ${walletAddress}: ${cached.count}`);
        return cached.count;
      }
      
      // If no cache and error occurred, return 0
      console.warn(`No cache available, returning 0 for ${walletAddress}`);
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
        console.log('Contract does not support ERC165/supportsInterface');
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
        console.log('Contract does not have name() function');
      }

      try {
        const symbol = await publicClient.readContract({
          address: this.contractAddress as `0x${string}`,
          abi: erc721Abi,
          functionName: 'symbol'
        });
        results.symbol = symbol as string;
      } catch (e) {
        console.log('Contract does not have symbol() function');
      }

      try {
        const totalSupply = await publicClient.readContract({
          address: this.contractAddress as `0x${string}`,
          abi: erc721Abi,
          functionName: 'totalSupply'
        });
        results.totalSupply = Number(totalSupply);
      } catch (e) {
        console.log('Contract does not have totalSupply() function');
      }

      return results;
    } catch (error) {
      console.error('Error fetching contract info:', error);
      return { validation: { isValid: false, error: error instanceof Error ? error.message : String(error) } };
    }
  }

  /**
   * Clear cache for a specific wallet (useful after transactions)
   */
  static clearCache(walletAddress?: string): void {
    if (walletAddress) {
      this.nftCache.delete(walletAddress.toLowerCase());
    } else {
      this.nftCache.clear();
    }
  }

  /**
   * Get cache stats (for debugging)
   */
  static getCacheStats(): { size: number; entries: Array<{ address: string; count: number; age: number }> } {
    const now = Date.now();
    const entries = Array.from(this.nftCache.entries()).map(([address, data]) => ({
      address,
      count: data.count,
      age: Math.floor((now - data.timestamp) / 1000) // age in seconds
    }));

    return {
      size: this.nftCache.size,
      entries
    };
  }

  /**
   * Get all NFT token IDs owned by a wallet address
   * Uses ERC721Enumerable if available, falls back to checking common ranges
   */
  static async getOwnedTokenIds(walletAddress: string): Promise<number[]> {
    try {
      if (!this.contractAddress || !this.isValidAddress(walletAddress)) {
        return [];
      }

      console.log(`Fetching owned token IDs for ${walletAddress}`);

      // First, get the balance to know how many tokens to fetch
      const balance = await this.getNFTCount(walletAddress);
      if (balance === 0) {
        return [];
      }

      // Try ERC721Enumerable approach first
      try {
        const tokenIds: number[] = [];
        for (let i = 0; i < balance; i++) {
          const tokenId = await publicClient.readContract({
            address: this.contractAddress as `0x${string}`,
            abi: erc721EnumerableAbi,
            functionName: 'tokenOfOwnerByIndex',
            args: [walletAddress as `0x${string}`, BigInt(i)]
          });
          tokenIds.push(Number(tokenId));
        }
        console.log(`Successfully fetched ${tokenIds.length} token IDs using enumerable: ${tokenIds}`);
        return tokenIds.sort((a, b) => a - b);
      } catch (enumerableError) {
        console.log('ERC721Enumerable not supported, trying fallback method');
        
        // Fallback: check token IDs by range (assuming sequential minting)
        // This is less efficient but works for most NFT contracts
        try {
          const totalSupply = await publicClient.readContract({
            address: this.contractAddress as `0x${string}`,
            abi: erc721EnumerableAbi,
            functionName: 'totalSupply'
          });

          const ownedTokenIds: number[] = [];
          const maxTokens = Math.min(Number(totalSupply), 10000); // Limit to prevent excessive calls
          
          // Check ownership of each token ID up to total supply
          const batchSize = 10; // Reduced batch size to avoid rate limits
          for (let start = 1; start <= maxTokens; start += batchSize) {
            const end = Math.min(start + batchSize - 1, maxTokens);
            const batchPromises: Promise<{ tokenId: number; owner: string | null }>[] = [];

            for (let tokenId = start; tokenId <= end; tokenId++) {
              batchPromises.push(
                // Try primary client first, fallback to backup on rate limit
                this.callWithFallback(
                  () => publicClient.readContract({
                    address: this.contractAddress as `0x${string}`,
                    abi: erc721EnumerableAbi,
                    functionName: 'ownerOf',
                    args: [BigInt(tokenId)]
                  }),
                  () => backupClient.readContract({
                    address: this.contractAddress as `0x${string}`,
                    abi: erc721EnumerableAbi,
                    functionName: 'ownerOf',
                    args: [BigInt(tokenId)]
                  })
                ).then(owner => ({ tokenId, owner: owner as string }))
                .catch(() => ({ tokenId, owner: null })) // Token doesn't exist
              );
            }

            const batchResults = await Promise.all(batchPromises);
            for (const result of batchResults) {
              if (result.owner?.toLowerCase() === walletAddress.toLowerCase()) {
                ownedTokenIds.push(result.tokenId);
              }
            }

            // Add delay between batches to avoid rate limiting
            if (start + batchSize <= maxTokens) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }

            // If we found all expected tokens, we can stop early
            if (ownedTokenIds.length >= balance) {
              break;
            }
          }

          console.log(`Fallback method found ${ownedTokenIds.length} token IDs: ${ownedTokenIds}`);
          return ownedTokenIds.sort((a, b) => a - b);
        } catch (fallbackError) {
          console.error('Both enumerable and fallback methods failed:', fallbackError);
          return [];
        }
      }
    } catch (error) {
      console.error(`Error fetching token IDs for ${walletAddress}:`, error);
      return [];
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
      console.log('Cannot check enumerable support:', error);
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
        console.log('Rate limited, trying backup RPC...');
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
        fetchURL = tokenURI.replace('ipfs://', 'https://ipfs.io/ipfs/');
      }

      const response = await fetch(fetchURL);
      if (!response.ok) {
        throw new Error(`Failed to fetch metadata: ${response.status}`);
      }

      const metadata = await response.json();
      
      // Handle IPFS image URLs
      if (metadata.image && metadata.image.startsWith('ipfs://')) {
        metadata.image = metadata.image.replace('ipfs://', 'https://ipfs.io/ipfs/');
      }

      return metadata;
    } catch (error) {
      console.error(`Error fetching metadata from ${tokenURI}:`, error);
      return null;
    }
  }

  /**
   * Get NFT metadata with caching
   */
  static async getNFTMetadata(tokenId: number): Promise<{
    tokenId: number;
    name?: string;
    image?: string;
    description?: string;
    attributes?: any[];
  }> {
    try {
      const tokenURI = await this.getTokenURI(tokenId);
      if (!tokenURI) {
        return { tokenId, name: `Shellie #${tokenId}` };
      }

      const metadata = await this.fetchMetadata(tokenURI);
      if (!metadata) {
        return { tokenId, name: `Shellie #${tokenId}` };
      }

      return {
        tokenId,
        name: metadata.name || `Shellie #${tokenId}`,
        image: metadata.image,
        description: metadata.description,
        attributes: metadata.attributes
      };
    } catch (error) {
      console.error(`Error getting NFT metadata for token ${tokenId}:`, error);
      return { tokenId, name: `Shellie #${tokenId}` };
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

      console.log(`Checking approval for NFT ${tokenId} for staking contract ${stakingContractAddress}`);

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

      console.log(`NFT ${tokenId} approval status:`, {
        approvedAddress,
        isApprovedForAll,
        stakingContractAddress,
        isApproved
      });

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
    console.log(`Checking approval for ${tokenIds.length} NFTs...`);
    
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
        console.log('✅ User has approved all NFTs for staking contract');
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

    console.log(`Approval check complete:`, { approved: approved.length, needApproval: needApproval.length });
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