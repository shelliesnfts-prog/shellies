'use client';

import { useState, useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';
import { StakingService } from '@/lib/staking-service';
import { NFTService } from '@/lib/nft-service';

export interface StakingBreakdown {
  day: number;
  week: number;
  month: number;
  total: number;
}

export interface NftAndStakingData {
  nftCount: number;
  stakingBreakdown: StakingBreakdown;
  isStaker: boolean;
  isNFTHolder: boolean;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useNftAndStaking(): NftAndStakingData {
  const { address, isConnected } = useAccount();

  const [nftCount, setNftCount] = useState<number>(0);
  const [stakingBreakdown, setStakingBreakdown] = useState<StakingBreakdown>({
    day: 0,
    week: 0,
    month: 0,
    total: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchedAddressRef = useRef<string | null>(null);
  const isFetchingRef = useRef<boolean>(false);

  const fetchData = async () => {
    if (!isConnected || !address) {
      setNftCount(0);
      setStakingBreakdown({ day: 0, week: 0, month: 0, total: 0 });
      setLoading(false);
      fetchedAddressRef.current = null;
      return;
    }

    if (fetchedAddressRef.current === address || isFetchingRef.current) {
      return;
    }

    try {
      isFetchingRef.current = true;
      setLoading(true);
      setError(null);

      const [nftCountResult, stakingResult] = await Promise.all([
        NFTService.getNFTCount(address),
        StakingService.getStakingPeriodBreakdown(address),
      ]);

      setNftCount(nftCountResult);
      setStakingBreakdown(stakingResult);
      fetchedAddressRef.current = address;
    } catch (err) {
      console.error('Error fetching NFT/staking data:', err);
      setError('Failed to fetch NFT data');
      setNftCount(0);
      setStakingBreakdown({ day: 0, week: 0, month: 0, total: 0 });
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  };

  useEffect(() => {
    fetchData();
  }, [address, isConnected]);

  const refetch = () => {
    fetchedAddressRef.current = null;
    fetchData();
  };

  return {
    nftCount,
    stakingBreakdown,
    isStaker: stakingBreakdown.total > 0,
    isNFTHolder: nftCount > 0,
    loading,
    error,
    refetch,
  };
}
