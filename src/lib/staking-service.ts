import { createPublicClient, http } from 'viem';
import { defineChain } from 'viem';
import { staking_abi } from './staking-abi';

// Ink chain configuration (same as in nft-service)
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

// Create Viem client for Ink blockchain with rate limit protection
const publicClient = createPublicClient({
  chain: inkChain,
  transport: http('https://rpc-qnd.inkonchain.com', {  // Use backup RPC first
    timeout: 3000,
    retryCount: 2,
    retryDelay: 1000
  })
});

// Backup client
const backupClient = createPublicClient({
  chain: inkChain,
  transport: http('https://rpc-gel.inkonchain.com', {
    timeout: 5000,
    retryCount: 1,
    retryDelay: 2000
  })
});

export interface StakeInfo {
  tokenId: number;
  owner: string;
  stakedAt: number;
}

export class StakingService {
  private static contractAddress: string = process.env.NEXT_PUBLIC_STAKING_CONTRACT_ADDRESS || '';
  
  // Cache for staking data (shorter cache than NFT service due to more frequent changes)
  private static stakingCache = new Map<string, { tokenIds: number[]; timestamp: number; }>();
  private static readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

  /**
   * Get staked token IDs for a wallet address
   */
  static async getStakedTokenIds(walletAddress: string): Promise<number[]> {
    try {
      // Check cache first
      const cached = this.stakingCache.get(walletAddress.toLowerCase());
      const now = Date.now();
      
      if (cached && (now - cached.timestamp) < this.CACHE_DURATION) {
        return cached.tokenIds;
      }

      if (!this.contractAddress || !this.isValidAddress(walletAddress)) {
        return [];
      }


      const stakedTokens = await this.callWithFallback(
        () => publicClient.readContract({
          address: this.contractAddress as `0x${string}`,
          abi: staking_abi,
          functionName: 'getStakedTokens',
          args: [walletAddress as `0x${string}`]
        }),
        () => backupClient.readContract({
          address: this.contractAddress as `0x${string}`,
          abi: staking_abi,
          functionName: 'getStakedTokens',
          args: [walletAddress as `0x${string}`]
        })
      );

      const tokenIds = (stakedTokens as bigint[]).map(id => Number(id));
      
      // Cache the result
      this.stakingCache.set(walletAddress.toLowerCase(), {
        tokenIds,
        timestamp: now
      });

      return tokenIds;

    } catch (error) {
      console.error(`Error fetching staked tokens for ${walletAddress}:`, error);
      
      // Return cached value if available, even if expired
      const cached = this.stakingCache.get(walletAddress.toLowerCase());
      if (cached) {
        return cached.tokenIds;
      }
      
      return [];
    }
  }

  /**
   * Get detailed stake info for a specific token
   */
  static async getStakeInfo(tokenId: number): Promise<StakeInfo | null> {
    try {
      if (!this.contractAddress) {
        return null;
      }

      const stakeInfo = await publicClient.readContract({
        address: this.contractAddress as `0x${string}`,
        abi: staking_abi,
        functionName: 'stakes',
        args: [BigInt(tokenId)],
        blockTag: 'latest'
      });

      const [returnedTokenId, owner, stakedAt] = stakeInfo as [bigint, string, bigint];

      // If owner is zero address, token is not staked
      if (owner === '0x0000000000000000000000000000000000000000') {
        return null;
      }

      return {
        tokenId: Number(returnedTokenId),
        owner: owner,
        stakedAt: Number(stakedAt)
      };

    } catch (error) {
      console.error(`Error fetching stake info for token ${tokenId}:`, error);
      return null;
    }
  }

  /**
   * Get total number of stakers
   */
  static async getTotalStakers(): Promise<number> {
    try {
      if (!this.contractAddress) {
        return 0;
      }

      const totalStakers = await publicClient.readContract({
        address: this.contractAddress as `0x${string}`,
        abi: staking_abi,
        functionName: 'totalStakers',
        blockTag: 'latest'
      });

      return Number(totalStakers);
    } catch (error) {
      console.error('Error fetching total stakers:', error);
      return 0;
    }
  }

  /**
   * Get all stakers addresses
   */
  static async getAllStakers(): Promise<string[]> {
    try {
      if (!this.contractAddress) {
        return [];
      }

      const stakers = await publicClient.readContract({
        address: this.contractAddress as `0x${string}`,
        abi: staking_abi,
        functionName: 'getAllStakers',
        blockTag: 'latest'
      });

      return stakers as string[];
    } catch (error) {
      console.error('Error fetching all stakers:', error);
      return [];
    }
  }

  /**
   * Check if a user is currently a staker
   */
  static async isStaker(walletAddress: string): Promise<boolean> {
    try {
      if (!this.contractAddress || !this.isValidAddress(walletAddress)) {
        return false;
      }

      const isStaker = await publicClient.readContract({
        address: this.contractAddress as `0x${string}`,
        abi: staking_abi,
        functionName: 'isStaker',
        args: [walletAddress as `0x${string}`],
        blockTag: 'latest'
      });

      return isStaker as boolean;
    } catch (error) {
      console.error(`Error checking staker status for ${walletAddress}:`, error);
      return false;
    }
  }

  /**
   * Calculate daily points earned from staking
   */
  static calculateDailyPoints(stakedTokenCount: number): number {
    return stakedTokenCount * 10; // 10 points per staked NFT per day
  }

  /**
   * Calculate points earned since staking started
   * @param stakedAt - timestamp when staking started
   * @param stakedTokenCount - number of staked tokens
   */
  static calculateEarnedPoints(stakedAt: number, stakedTokenCount: number): number {
    const now = Date.now() / 1000; // Convert to seconds
    const daysPassed = Math.floor((now - stakedAt) / (24 * 60 * 60)); // Full days only
    return daysPassed * this.calculateDailyPoints(stakedTokenCount);
  }

  /**
   * Get staking stats for a user
   */
  static async getStakingStats(walletAddress: string): Promise<{
    totalStaked: number;
    dailyPoints: number;
    stakedTokenIds: number[];
    isCurrentStaker: boolean;
  }> {
    try {
      const stakedTokenIds = await this.getStakedTokenIds(walletAddress);
      const isCurrentStaker = await this.isStaker(walletAddress);
      
      return {
        totalStaked: stakedTokenIds.length,
        dailyPoints: this.calculateDailyPoints(stakedTokenIds.length),
        stakedTokenIds,
        isCurrentStaker
      };
    } catch (error) {
      console.error(`Error fetching staking stats for ${walletAddress}:`, error);
      return {
        totalStaked: 0,
        dailyPoints: 0,
        stakedTokenIds: [],
        isCurrentStaker: false
      };
    }
  }

  /**
   * Clear cache for a specific wallet (useful after transactions)
   */
  static clearCache(walletAddress?: string): void {
    if (walletAddress) {
      this.stakingCache.delete(walletAddress.toLowerCase());
    } else {
      this.stakingCache.clear();
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
   * Validate if an address looks like a valid Ethereum address
   */
  static isValidAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  /**
   * Get the staking contract address
   */
  static getContractAddress(): string {
    return this.contractAddress;
  }
}

// Export contract address for use in other components
export const STAKING_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_STAKING_CONTRACT_ADDRESS || '';