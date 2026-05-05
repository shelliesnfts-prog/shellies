'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useAccount, useReadContract } from 'wagmi';
import { useClaiming } from '@/hooks/useClaiming';
import { SHELLIES_POINTS_CONTRACT, SHELLIES_POINTS_ADDRESS } from '@/lib/shellies-points-contract';

interface User {
  id: string;
  wallet_address: string;
  points: number;
  last_claim: string | null;
  nft_count: number;
  game_score?: number;
  created_at: string;
  updated_at: string;
}

interface ClaimStatus {
  canClaim: boolean;
  secondsUntilNextClaim: number;
  stakedNFTCount: number;
  stakingPoints: number;
  currentPoints: number;
  lastClaim: string | null;
}

interface ClaimResult {
  success: boolean;
  message?: string;
  newPoints?: number;
  pointsAdded?: number;
  nftCount?: number;
  stakedNFTCount?: number;
  error?: string;
  nextClaimIn?: number;
}

interface PointsContextType {
  // State
  user: User | null;
  claimStatus: ClaimStatus | null;
  loading: boolean;
  claiming: boolean;
  error: string | null;

  // Actions
  executeClaim: () => void;
  executeClaimWithFees: () => void;
  // Legacy aliases kept so existing consumers don't break
  executeRegularClaim: () => Promise<ClaimResult>;
  executeStakingClaim: () => Promise<ClaimResult>;
  executeUnifiedClaim: () => Promise<ClaimResult>;
  refreshUserData: () => Promise<void>;
  refreshWithFreshData: () => Promise<void>;
  updatePoints: (newPoints: number) => void;

  // Utilities
  canPerformStaking: boolean;
  claimCooldown: number;

  // Paid claim state (tiered) + backward compat aliases (staker tier as default)
  canClaimWithFeesStaker: boolean;
  canClaimWithFeesHolder: boolean;
  canClaimWithFeesRegular: boolean;
  secondsUntilStaker: number;
  secondsUntilHolder: number;
  secondsUntilRegular: number;
  stakerTierCost: bigint;
  holderTierCost: bigint;
  regularTierCost: bigint;
  pointsPerStakedNFT: number;
  pointsPerHeldNFT: number;
  rewardPerRegularUser: number;
  executeClaimWithFeesStaker: () => void;
  executeClaimWithFeesHolder: () => void;
  executeClaimWithFeesRegular: () => void;
  isClaimWithFeesPending: boolean;
  isClaimWithFeesConfirming: boolean;
  isLoadingClaimStatus: boolean;
  // Backward compat — staker tier values
  canClaimWithFees: boolean;
  secondsUntilClaimWithFees: number;
  claimWithFeesCost: bigint;
  claimWithFeesReward: number;
  isLoadingPaidClaimConfig: boolean;
  isPaidClaimConfigured: boolean;
}

const PointsContext = createContext<PointsContextType | undefined>(undefined);

export function PointsProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const { address } = useAccount();

  const [user, setUser] = useState<User | null>(null);
  const [claimStatus, setClaimStatus] = useState<ClaimStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchingRef = useRef(false);
  const canPerformStaking = true;

  // Ref that always holds the latest on-chain claim values so fetchUserData can
  // apply them even when the chain data resolved before the API call completed.
  const chainClaimRef = useRef<{ canClaim: boolean; secondsUntilClaim: number; isLoading: boolean }>({
    canClaim: false,
    secondsUntilClaim: 0,
    isLoading: true,
  });

  // ── On-chain points balance ────────────────────────────────────────────────

  const { data: onChainBalanceRaw, refetch: refetchBalance } = useReadContract({
    address: SHELLIES_POINTS_ADDRESS,
    abi: SHELLIES_POINTS_CONTRACT.abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const onChainPoints = onChainBalanceRaw ? Number(onChainBalanceRaw as bigint) : 0;

  // Sync on-chain balance into user state whenever it updates
  useEffect(() => {
    if (onChainBalanceRaw !== undefined) {
      setUser(prev => prev ? { ...prev, points: onChainPoints } : null);
      setClaimStatus(prev => prev ? { ...prev, currentPoints: onChainPoints } : null);
    }
  }, [onChainBalanceRaw, onChainPoints]);

  // ── Claiming hook ─────────────────────────────────────────────────────────

  const {
    executeClaim: claimWrite,
    isClaimSuccess,
    isClaimWithFeesSuccess,
    claiming,
    canClaim,
    secondsUntilClaim,
    claimCooldown,
    refreshClaimStatus,
    // Tiered paid claim
    canClaimWithFeesStaker,
    canClaimWithFeesHolder,
    canClaimWithFeesRegular,
    secondsUntilStaker,
    secondsUntilHolder,
    secondsUntilRegular,
    stakerTierCost,
    holderTierCost,
    regularTierCost,
    pointsPerStakedNFT,
    pointsPerHeldNFT,
    rewardPerRegularUser,
    executeClaimWithFeesStaker,
    executeClaimWithFeesHolder,
    executeClaimWithFeesRegular,
    isClaimWithFeesPending,
    isClaimWithFeesConfirming,
    isLoadingClaimStatus,
  } = useClaiming();

  // Keep the chain-claim ref current so fetchUserData can read it synchronously
  useEffect(() => {
    chainClaimRef.current = { canClaim, secondsUntilClaim, isLoading: isLoadingClaimStatus };
  }, [canClaim, secondsUntilClaim, isLoadingClaimStatus]);

  // Refresh balance and cooldown state after successful claim
  useEffect(() => {
    if (isClaimSuccess || isClaimWithFeesSuccess) {
      // Optimistic update: the tx just confirmed — immediately show the cooldown
      // without waiting for the RPC node to catch up (it often lags by a few seconds).
      setClaimStatus(prev => prev ? {
        ...prev,
        canClaim: false,
        secondsUntilNextClaim: claimCooldown,
      } : null);

      // Also fetch actual values from chain and retry — RPC nodes can lag behind
      refetchBalance();
      refreshClaimStatus();
      const t1 = setTimeout(() => { refetchBalance(); refreshClaimStatus(); }, 2000);
      const t2 = setTimeout(() => { refetchBalance(); refreshClaimStatus(); }, 5000);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  }, [isClaimSuccess, isClaimWithFeesSuccess, refetchBalance, refreshClaimStatus, claimCooldown]);

  // Sync on-chain cooldown into claimStatus so the UI reflects chain state
  useEffect(() => {
    setClaimStatus(prev =>
      prev
        ? { ...prev, canClaim, secondsUntilNextClaim: secondsUntilClaim }
        : null
    );
  }, [canClaim, secondsUntilClaim]);

  // ── Fetch dashboard data ──────────────────────────────────────────────────

  const fetchUserData = useCallback(async () => {
    if (fetchingRef.current || status === 'loading') return;

    if (!session?.address) {
      setUser(null);
      setClaimStatus(null);
      setLoading(false);
      setError(null);
      return;
    }

    try {
      fetchingRef.current = true;
      setLoading(true);
      setError(null);

      const response = await fetch('/api/dashboard', {
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
        cache: 'no-store',
      });

      if (!response.ok) throw new Error('Failed to fetch user data');

      const data = await response.json();
      setUser(data.user);

      // If the on-chain data is already resolved, prefer it over the DB-derived values
      // to avoid the race where chain data loads before this API call completes.
      const chain = chainClaimRef.current;
      setClaimStatus({
        ...data.claimStatus,
        canClaim: !chain.isLoading ? chain.canClaim : data.claimStatus.canClaim,
        secondsUntilNextClaim: !chain.isLoading ? chain.secondsUntilClaim : data.claimStatus.secondsUntilNextClaim,
      });
    } catch (err) {
      console.error('Error fetching user data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch user data');
      setUser(null);
      setClaimStatus(null);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [session?.address, status]);

  // ── Claim actions ─────────────────────────────────────────────────────────

  const executeClaim = useCallback(() => {
    claimWrite();
  }, [claimWrite]);

  const executeClaimWithFees = useCallback(() => {
    executeClaimWithFeesStaker();
  }, [executeClaimWithFeesStaker]);

  // Legacy wrappers for existing consumers
  const executeRegularClaim = useCallback(async (): Promise<ClaimResult> => {
    claimWrite();
    return { success: true, message: 'Claim transaction submitted' };
  }, [claimWrite]);

  const executeStakingClaim = useCallback(async (): Promise<ClaimResult> => {
    claimWrite();
    return { success: true, message: 'Claim transaction submitted' };
  }, [claimWrite]);

  const executeUnifiedClaim = useCallback(async (): Promise<ClaimResult> => {
    claimWrite();
    return { success: true, message: 'Claim transaction submitted' };
  }, [claimWrite]);

  // ── Manual refresh ────────────────────────────────────────────────────────

  const refreshUserData = useCallback(async () => {
    await fetchUserData();
    refetchBalance();
  }, [fetchUserData, refetchBalance]);

  const refreshWithFreshData = useCallback(async () => {
    if (!session?.address) return;
    try {
      await fetchUserData();
      refetchBalance();
    } catch (err) {
      console.error('Error refreshing with fresh data:', err);
      await fetchUserData();
    }
  }, [session?.address, fetchUserData, refetchBalance]);

  // ── Optimistic update helper ──────────────────────────────────────────────

  const updatePoints = useCallback((newPoints: number) => {
    setUser(prev => prev ? { ...prev, points: newPoints } : null);
    setClaimStatus(prev => prev ? { ...prev, currentPoints: newPoints } : null);

    if (session?.address) {
      window.dispatchEvent(new CustomEvent('pointsUpdated', {
        detail: { newPoints, walletAddress: session.address },
      }));
    }
  }, [session?.address]);

  // ── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => { fetchUserData(); }, [fetchUserData]);

  useEffect(() => {
    const handlePointsUpdate = (event: CustomEvent) => {
      const { newPoints, walletAddress } = event.detail;
      if (session?.address === walletAddress) {
        updatePoints(newPoints);
        setTimeout(() => refreshUserData(), 1000);
      }
    };

    const handleAccountSwitch = () => {
      setUser(null);
      setClaimStatus(null);
      setError(null);
      setLoading(true);
      fetchingRef.current = false;
    };

    const handleStakingUpdate = async (event: Event) => {
      const customEvent = event as CustomEvent;
      if (session?.address === customEvent.detail?.walletAddress) {
        await refreshUserData();
      }
    };

    window.addEventListener('pointsUpdated', handlePointsUpdate as EventListener);
    window.addEventListener('accountSwitched', handleAccountSwitch as EventListener);
    window.addEventListener('stakingUpdated', handleStakingUpdate);

    return () => {
      window.removeEventListener('pointsUpdated', handlePointsUpdate as EventListener);
      window.removeEventListener('accountSwitched', handleAccountSwitch as EventListener);
      window.removeEventListener('stakingUpdated', handleStakingUpdate);
    };
  }, [session?.address, updatePoints, refreshUserData]);

  useEffect(() => {
    if (!canClaim) {
      const interval = setInterval(() => fetchUserData(), 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [canClaim, fetchUserData]);

  const value: PointsContextType = {
    user,
    claimStatus,
    loading,
    claiming,
    error,
    executeClaim,
    executeClaimWithFees,
    executeRegularClaim,
    executeStakingClaim,
    executeUnifiedClaim,
    refreshUserData,
    refreshWithFreshData,
    updatePoints,
    canPerformStaking,
    claimCooldown,
    canClaimWithFeesStaker,
    canClaimWithFeesHolder,
    canClaimWithFeesRegular,
    secondsUntilStaker,
    secondsUntilHolder,
    secondsUntilRegular,
    stakerTierCost,
    holderTierCost,
    regularTierCost,
    pointsPerStakedNFT,
    pointsPerHeldNFT,
    rewardPerRegularUser,
    executeClaimWithFeesStaker,
    executeClaimWithFeesHolder,
    executeClaimWithFeesRegular,
    isClaimWithFeesPending,
    isClaimWithFeesConfirming,
    // Backward compat aliases for paid claim (uses staker tier as default)
    canClaimWithFees: canClaimWithFeesStaker,
    secondsUntilClaimWithFees: secondsUntilStaker,
    claimWithFeesCost: stakerTierCost,
    claimWithFeesReward: pointsPerStakedNFT,
    isLoadingPaidClaimConfig: false,
    isPaidClaimConfigured: true,
    isLoadingClaimStatus,
  };

  return (
    <PointsContext.Provider value={value}>
      {children}
    </PointsContext.Provider>
  );
}

export function usePoints() {
  const context = useContext(PointsContext);
  if (context === undefined) {
    throw new Error('usePoints must be used within a PointsProvider');
  }
  return context;
}
