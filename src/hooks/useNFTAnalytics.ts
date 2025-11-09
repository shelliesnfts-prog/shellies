/**
 * @file useNFTAnalytics.ts
 * @description Hook for fetching NFT and staking analytics
 * Reusable across components without code duplication
 * Fetches data only once on initialization
 */

import { useState, useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';
import { StakingService } from '@/lib/staking-service';
import { NFTService } from '@/lib/nft-service';

export interface NFTAnalytics {
  nftCount: number;
  stakedCount: number;
  isStaker: boolean;
  isNFTHolder: boolean;
  loading: boolean;
  error: string | null;
}

/**
 * Hook to fetch NFT and staking analytics for the connected wallet
 * Fetches only once on mount or when wallet address changes
 */
export function useNFTAnalytics(): NFTAnalytics {
  const { address, isConnected } = useAccount();
  
  const [nftCount, setNftCount] = useState<number>(0);
  const [stakedCount, setStakedCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Track if we've already fetched for this address
  const fetchedAddressRef = useRef<string | null>(null);
  const isFetchingRef = useRef<boolean>(false);

  useEffect(() => {
    const fetchAnalytics = async () => {
      // Skip if not connected or no address
      if (!isConnected || !address) {
        setNftCount(0);
        setStakedCount(0);
        setLoading(false);
        fetchedAddressRef.current = null;
        return;
      }

      // Skip if already fetched for this address or currently fetching
      if (fetchedAddressRef.current === address || isFetchingRef.current) {
        return;
      }

      try {
        isFetchingRef.current = true;
        setLoading(true);
        setError(null);

        // Fetch NFT count and staking stats in parallel
        const [nftCountResult, stakingStats] = await Promise.all([
          NFTService.getNFTCount(address),
          StakingService.getStakingStats(address)
        ]);

        setNftCount(nftCountResult);
        setStakedCount(stakingStats.totalStaked);
        
        // Mark this address as fetched
        fetchedAddressRef.current = address;
      } catch (err) {
        console.error('Error fetching NFT analytics:', err);
        setError('Failed to fetch NFT data');
        setNftCount(0);
        setStakedCount(0);
      } finally {
        setLoading(false);
        isFetchingRef.current = false;
      }
    };

    fetchAnalytics();
  }, [address, isConnected]);

  return {
    nftCount,
    stakedCount,
    isStaker: stakedCount > 0,
    isNFTHolder: nftCount > 0,
    loading,
    error
  };
}
