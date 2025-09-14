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

export enum LockPeriod {
  DAY = 0,    // 1 day
  WEEK = 1,   // 7 days
  MONTH = 2   // 30 days
}

export interface StakeInfo {
  tokenId: number;
  owner: string;
  stakedAt: number;
  lockEndTime: number;
  lockPeriod: LockPeriod;
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

      const [returnedTokenId, owner, stakedAt, lockEndTime, lockPeriod] = stakeInfo as [bigint, string, bigint, bigint, number];

      // If owner is zero address, token is not staked
      if (owner === '0x0000000000000000000000000000000000000000') {
        return null;
      }

      return {
        tokenId: Number(returnedTokenId),
        owner: owner,
        stakedAt: Number(stakedAt),
        lockEndTime: Number(lockEndTime),
        lockPeriod: lockPeriod as LockPeriod
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

  /**
   * Get human-readable label for lock period
   */
  static getLockPeriodLabel(period: LockPeriod): string {
    switch (period) {
      case LockPeriod.DAY:
        return '1 Day';
      case LockPeriod.WEEK:
        return '1 Week';
      case LockPeriod.MONTH:
        return '1 Month';
      default:
        return 'Unknown';
    }
  }

  /**
   * Get lock duration in seconds
   */
  static getLockDuration(period: LockPeriod): number {
    switch (period) {
      case LockPeriod.DAY:
        return 24 * 60 * 60; // 1 day
      case LockPeriod.WEEK:
        return 7 * 24 * 60 * 60; // 7 days
      case LockPeriod.MONTH:
        return 30 * 24 * 60 * 60; // 30 days
      default:
        return 0;
    }
  }

  /**
   * Check if a token can be unstaked (lock period has ended)
   */
  static async canUnstake(tokenId: number): Promise<{ canUnstake: boolean; timeRemaining: number }> {
    try {
      if (!this.contractAddress) {
        return { canUnstake: false, timeRemaining: 0 };
      }

      const result = await publicClient.readContract({
        address: this.contractAddress as `0x${string}`,
        abi: staking_abi,
        functionName: 'canUnstake',
        args: [BigInt(tokenId)],
        blockTag: 'latest'
      });

      const [canUnstake, timeRemaining] = result as [boolean, bigint];

      return {
        canUnstake,
        timeRemaining: Number(timeRemaining)
      };
    } catch (error) {
      console.error(`Error checking if token ${tokenId} can be unstaked:`, error);
      return { canUnstake: false, timeRemaining: 0 };
    }
  }

  /**
   * Format time remaining in a human-readable format
   * @param seconds - Time remaining in seconds
   * @returns Formatted time string
   */
  static formatTimeRemaining(seconds: number): string {
    if (seconds <= 0) return 'Ready to unstake';

    const MINUTE = 60;
    const HOUR = 60 * MINUTE;
    const DAY = 24 * HOUR;
    const WEEK = 7 * DAY;
    const MONTH = 30 * DAY;

    // >= 1 Month: Show months
    if (seconds >= MONTH) {
      const months = Math.floor(seconds / MONTH);
      return `${months} month${months > 1 ? 's' : ''}`;
    }

    // >= 1 Week: Show weeks
    if (seconds >= WEEK) {
      const weeks = Math.floor(seconds / WEEK);
      return `${weeks} week${weeks > 1 ? 's' : ''}`;
    }

    // >= 1 Day: Show days
    if (seconds >= DAY) {
      const days = Math.floor(seconds / DAY);
      return `${days} day${days > 1 ? 's' : ''}`;
    }

    // >= 1 Hour: Show hours, minutes, and seconds
    if (seconds >= HOUR) {
      const hours = Math.floor(seconds / HOUR);
      const minutes = Math.floor((seconds % HOUR) / MINUTE);
      const remainingSeconds = Math.floor(seconds % MINUTE);

      let result = `${hours}h`;
      if (minutes > 0) {
        result += ` ${minutes}m`;
      }
      if (remainingSeconds > 0) {
        result += ` ${remainingSeconds}s`;
      }
      return result;
    }

    // < 1 Hour: Show minutes and seconds
    const minutes = Math.floor(seconds / MINUTE);
    const remainingSeconds = Math.floor(seconds % MINUTE);

    if (minutes > 0) {
      if (remainingSeconds > 0) {
        return `${minutes}m ${remainingSeconds}s`;
      }
      return `${minutes}m`;
    }

    return `${remainingSeconds}s`;
  }

  /**
   * Get breakdown of staked NFTs by lock period for a user
   * @param walletAddress - User's wallet address
   * @returns Object with counts for each period
   */
  static async getStakingPeriodBreakdown(walletAddress: string): Promise<{
    day: number;
    week: number;
    month: number;
    total: number;
  }> {
    try {
      if (!this.contractAddress || !this.isValidAddress(walletAddress)) {
        return { day: 0, week: 0, month: 0, total: 0 };
      }

      // Get all staked token IDs for the user
      const stakedTokenIds = await this.getStakedTokenIds(walletAddress);

      if (stakedTokenIds.length === 0) {
        return { day: 0, week: 0, month: 0, total: 0 };
      }

      // Fetch stake info for each token to get the lock period
      const stakeInfoPromises = stakedTokenIds.map(async (tokenId) => {
        try {
          const stakeInfo = await this.callWithFallback(
            () => publicClient.readContract({
              address: this.contractAddress as `0x${string}`,
              abi: staking_abi,
              functionName: 'stakes',
              args: [BigInt(tokenId)],
              blockTag: 'latest'
            }),
            () => backupClient.readContract({
              address: this.contractAddress as `0x${string}`,
              abi: staking_abi,
              functionName: 'stakes',
              args: [BigInt(tokenId)],
              blockTag: 'latest'
            })
          );

          const [, , , , lockPeriod] = stakeInfo as [bigint, string, bigint, bigint, number];
          return lockPeriod as LockPeriod;
        } catch (error) {
          console.error(`Failed to get stake info for token ${tokenId}:`, error);
          return null;
        }
      });

      const stakePeriods = await Promise.all(stakeInfoPromises);

      // Count NFTs by period
      const breakdown = {
        day: 0,
        week: 0,
        month: 0,
        total: stakedTokenIds.length
      };

      stakePeriods.forEach((period) => {
        if (period === LockPeriod.DAY) {
          breakdown.day++;
        } else if (period === LockPeriod.WEEK) {
          breakdown.week++;
        } else if (period === LockPeriod.MONTH) {
          breakdown.month++;
        }
      });

      return breakdown;

    } catch (error) {
      console.error(`Error fetching staking period breakdown for ${walletAddress}:`, error);
      return { day: 0, week: 0, month: 0, total: 0 };
    }
  }
}

// Export contract address for use in other components
export const STAKING_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_STAKING_CONTRACT_ADDRESS || '';