'use client';

import { useReadContracts } from 'wagmi';
import { shelliesPointsAbi } from '@/lib/shellies-points-abi';
import { SHELLIES_POINTS_ADDRESS } from '@/lib/shellies-points-contract';
import { inkChain } from '@/lib/wagmi';

export interface StakingPointRates {
  daily: number;
  weekly: number;
  monthly: number;
  isLoading: boolean;
  isError: boolean;
}

const DEFAULT_RATES = { daily: 7, weekly: 10, monthly: 20 };

export function useStakingPointRates(): StakingPointRates {
  const { data, isLoading, isError } = useReadContracts({
    contracts: [
      {
        address: SHELLIES_POINTS_ADDRESS,
        abi: shelliesPointsAbi,
        functionName: 'pointsPerDailyStakedNFT',
        chainId: inkChain.id,
      },
      {
        address: SHELLIES_POINTS_ADDRESS,
        abi: shelliesPointsAbi,
        functionName: 'pointsPerWeeklyStakedNFT',
        chainId: inkChain.id,
      },
      {
        address: SHELLIES_POINTS_ADDRESS,
        abi: shelliesPointsAbi,
        functionName: 'pointsPerMonthlyStakedNFT',
        chainId: inkChain.id,
      },
    ],
    query: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  });

  const dailyRaw = data?.[0]?.result as bigint | undefined;
  const weeklyRaw = data?.[1]?.result as bigint | undefined;
  const monthlyRaw = data?.[2]?.result as bigint | undefined;

  return {
    daily: dailyRaw !== undefined ? Number(dailyRaw) : DEFAULT_RATES.daily,
    weekly: weeklyRaw !== undefined ? Number(weeklyRaw) : DEFAULT_RATES.weekly,
    monthly: monthlyRaw !== undefined ? Number(monthlyRaw) : DEFAULT_RATES.monthly,
    isLoading,
    isError,
  };
}
