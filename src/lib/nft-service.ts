import { createPublicClient, http, parseAbi } from 'viem';
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

// Create Viem client for Ink blockchain with aggressive timeouts for speed
const publicClient = createPublicClient({
  chain: inkChain,
  transport: http('https://rpc-gel.inkonchain.com', {
    timeout: 1500,   // 1.5 seconds timeout (very aggressive)
    retryCount: 1,   // Single retry only 
    retryDelay: 200  // Fast retry delay
  })
});

// Comprehensive ERC721 ABI that includes various common implementations
const erc721Abi = parseAbi([
  // Standard ERC721 functions
  'function balanceOf(address owner) view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function totalSupply() view returns (uint256)',
  
  // Enumerable extension
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  'function tokenByIndex(uint256 index) view returns (uint256)',
  
  // Common OpenZeppelin functions
  'function supportsInterface(bytes4 interfaceId) view returns (bool)',
]);

// Proxy contract ABI for detecting implementation
const proxyAbi = parseAbi([
  'function implementation() view returns (address)',
  'function admin() view returns (address)',
  'function owner() view returns (address)',
]);

// ERC165 interface IDs for detection
const ERC721_INTERFACE_ID = '0x80ac58cd';
const ERC721_ENUMERABLE_INTERFACE_ID = '0x780e9d63';

export class NFTService {
  private static contractAddress: string = process.env.NEXT_PUBLIC_SHELLIES_CONTRACT_ADDRESS || '';
  
  // Cache for NFT counts (2 hour cache for better performance)
  private static nftCache = new Map<string, { count: number; timestamp: number; }>();
  private static readonly CACHE_DURATION = 2 * 60 * 60 * 1000; // 2 hours (reduced blockchain calls)

  /**
   * Get NFT count for a wallet address
   * Uses caching to prevent excessive RPC calls
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

      // Use the standard balanceOf call with proper error handling
      const balance = await publicClient.readContract({
        address: this.contractAddress as `0x${string}`,
        abi: erc721Abi,
        functionName: 'balanceOf',
        args: [walletAddress as `0x${string}`],
        // Add block parameter to ensure we get latest state
        blockTag: 'latest'
      });

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
        error: error.message,
        cause: error.cause?.message,
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
   * 1 NFT = 1 point, 0 NFTs = 0.1 points
   */
  static calculateClaimPoints(nftCount: number): number {
    if (nftCount === 0) {
      return 0.1;
    }
    return nftCount;
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
        const supportsERC721 = await publicClient.readContract({
          address: this.contractAddress as `0x${string}`,
          abi: erc721Abi,
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
        if (error.message.includes('revert') || 
            error.message.includes('execution reverted') ||
            error.message.includes('invalid address') ||
            error.message.toLowerCase().includes('zero address')) {
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
          error: `balanceOf function test failed: ${error.message}` 
        };
      }
    } catch (error) {
      return { isValid: false, error: `Validation failed: ${error.message}` };
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
      return { validation: { isValid: false, error: error.message } };
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
   * Validate if an address looks like a valid Ethereum address
   */
  static isValidAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }
}

// Export contract address for use in other components
export const SHELLIES_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_SHELLIES_CONTRACT_ADDRESS || '';