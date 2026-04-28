'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { SHELLIES_POINTS_CONTRACT, SHELLIES_POINTS_ADDRESS } from '@/lib/shellies-points-contract';

export type TierCategory = 0 | 1 | 2;
export const TierCategory = {
  REGULAR: 0 as TierCategory,
  HOLDER: 1 as TierCategory,
  STAKER: 2 as TierCategory,
};

function tierName(t: TierCategory): string {
  return t === 2 ? 'Staker' : t === 1 ? 'Holder' : 'Regular';
}

function formatCooldown(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  if (m > 0) return `${m}m`;
  return `${seconds}s`;
}

export function useClaiming() {
  const { address } = useAccount();
  const nowSec = Math.floor(Date.now() / 1000);

  // Optimistic timestamps set immediately after a successful claim so the
  // cooldown appears without waiting for the on-chain refetch to complete.
  const [optimisticLastClaim, setOptimisticLastClaim] = useState<number | null>(null);
  const [optimisticLastClaimStaker, setOptimisticLastClaimStaker] = useState<number | null>(null);
  const [optimisticLastClaimHolder, setOptimisticLastClaimHolder] = useState<number | null>(null);
  const [optimisticLastClaimRegular, setOptimisticLastClaimRegular] = useState<number | null>(null);
  // Tracks which paid tier the in-flight tx belongs to so we know which
  // optimistic timestamp to set on success.
  const [pendingPaidTier, setPendingPaidTier] = useState<'staker' | 'holder' | 'regular' | null>(null);

  // ── Free claim reads (unchanged) ───────────────────────────────────────

  const { data: lastClaimRaw, refetch: refetchLastClaim, isLoading: isLoadingLastClaim, isFetching: isFetchingLastClaim } = useReadContract({
    address: SHELLIES_POINTS_ADDRESS,
    abi: SHELLIES_POINTS_CONTRACT.abi,
    functionName: 'lastClaim',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: claimCooldownRaw } = useReadContract({
    address: SHELLIES_POINTS_ADDRESS,
    abi: SHELLIES_POINTS_CONTRACT.abi,
    functionName: 'claimCooldown',
  });

  // ── Tier config reads ────────────────────────────────────────────────────

  const { data: stakerTierCostRaw } = useReadContract({
    address: SHELLIES_POINTS_ADDRESS,
    abi: SHELLIES_POINTS_CONTRACT.abi,
    functionName: 'stakerTierCost',
  });
  const { data: holderTierCostRaw } = useReadContract({
    address: SHELLIES_POINTS_ADDRESS,
    abi: SHELLIES_POINTS_CONTRACT.abi,
    functionName: 'holderTierCost',
  });
  const { data: regularTierCostRaw } = useReadContract({
    address: SHELLIES_POINTS_ADDRESS,
    abi: SHELLIES_POINTS_CONTRACT.abi,
    functionName: 'regularTierCost',
  });

  const { data: stakerTierCooldownRaw } = useReadContract({
    address: SHELLIES_POINTS_ADDRESS,
    abi: SHELLIES_POINTS_CONTRACT.abi,
    functionName: 'stakerTierCooldown',
  });
  const { data: holderTierCooldownRaw } = useReadContract({
    address: SHELLIES_POINTS_ADDRESS,
    abi: SHELLIES_POINTS_CONTRACT.abi,
    functionName: 'holderTierCooldown',
  });
  const { data: regularTierCooldownRaw } = useReadContract({
    address: SHELLIES_POINTS_ADDRESS,
    abi: SHELLIES_POINTS_CONTRACT.abi,
    functionName: 'regularTierCooldown',
  });

  const { data: pointsPerStakedNFT } = useReadContract({
    address: SHELLIES_POINTS_ADDRESS,
    abi: SHELLIES_POINTS_CONTRACT.abi,
    functionName: 'pointsPerStakedNFT',
  });
  const { data: pointsPerAvailableNFT } = useReadContract({
    address: SHELLIES_POINTS_ADDRESS,
    abi: SHELLIES_POINTS_CONTRACT.abi,
    functionName: 'pointsPerAvailableNFT',
  });
  const { data: pointsPerHeldNFT } = useReadContract({
    address: SHELLIES_POINTS_ADDRESS,
    abi: SHELLIES_POINTS_CONTRACT.abi,
    functionName: 'pointsPerHeldNFT',
  });
  const { data: pointsForRegularUser } = useReadContract({
    address: SHELLIES_POINTS_ADDRESS,
    abi: SHELLIES_POINTS_CONTRACT.abi,
    functionName: 'pointsForRegularUser',
  });
  const { data: rewardPerRegularUser } = useReadContract({
    address: SHELLIES_POINTS_ADDRESS,
    abi: SHELLIES_POINTS_CONTRACT.abi,
    functionName: 'rewardPerRegularUser',
  });
  const { data: pointsPerDailyStakedNFT } = useReadContract({
    address: SHELLIES_POINTS_ADDRESS,
    abi: SHELLIES_POINTS_CONTRACT.abi,
    functionName: 'pointsPerDailyStakedNFT',
  });
  const { data: pointsPerWeeklyStakedNFT } = useReadContract({
    address: SHELLIES_POINTS_ADDRESS,
    abi: SHELLIES_POINTS_CONTRACT.abi,
    functionName: 'pointsPerWeeklyStakedNFT',
  });
  const { data: pointsPerMonthlyStakedNFT } = useReadContract({
    address: SHELLIES_POINTS_ADDRESS,
    abi: SHELLIES_POINTS_CONTRACT.abi,
    functionName: 'pointsPerMonthlyStakedNFT',
  });

  // ── Per-tier last-claim reads ──────────────────────────────────────────

  const { data: lastClaimStakerTierRaw, refetch: refetchStaker } = useReadContract({
    address: SHELLIES_POINTS_ADDRESS,
    abi: SHELLIES_POINTS_CONTRACT.abi,
    functionName: 'lastClaimStakerTier',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
  const { data: lastClaimHolderTierRaw, refetch: refetchHolder } = useReadContract({
    address: SHELLIES_POINTS_ADDRESS,
    abi: SHELLIES_POINTS_CONTRACT.abi,
    functionName: 'lastClaimHolderTier',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
  const { data: lastClaimRegularTierRaw, refetch: refetchRegular } = useReadContract({
    address: SHELLIES_POINTS_ADDRESS,
    abi: SHELLIES_POINTS_CONTRACT.abi,
    functionName: 'lastClaimRegularTier',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // ── User category read ─────────────────────────────────────────────────

  const { data: userCategoryRaw } = useReadContract({
    address: SHELLIES_POINTS_ADDRESS,
    abi: SHELLIES_POINTS_CONTRACT.abi,
    functionName: 'getUserCategory',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // ── Derived free-claim state ───────────────────────────────────────────

  const claimCooldown = claimCooldownRaw ? Number(claimCooldownRaw as bigint) : 86400;
  const lastClaimOnChain = lastClaimRaw ? Number(lastClaimRaw as bigint) : 0;
  // Use the optimistic timestamp until the refetch returns a fresher value.
  const lastClaim = optimisticLastClaim !== null
    ? Math.max(optimisticLastClaim, lastClaimOnChain)
    : lastClaimOnChain;
  const secondsUntilClaim = Math.max(0, lastClaim + claimCooldown - nowSec);
  const isLoadingClaimStatus = isLoadingLastClaim || isFetchingLastClaim;
  const canClaim = !isLoadingClaimStatus && secondsUntilClaim === 0;

  // ── Derived paid-claim state per tier ──────────────────────────────────

  const stakerTierCost = (stakerTierCostRaw as bigint | undefined) ?? BigInt(0);
  const holderTierCost = (holderTierCostRaw as bigint | undefined) ?? BigInt(0);
  const regularTierCost = (regularTierCostRaw as bigint | undefined) ?? BigInt(0);

  const stakerTierCooldown = stakerTierCooldownRaw ? Number(stakerTierCooldownRaw as bigint) : 0;
  const holderTierCooldown = holderTierCooldownRaw ? Number(holderTierCooldownRaw as bigint) : 0;
  const regularTierCooldown = regularTierCooldownRaw ? Number(regularTierCooldownRaw as bigint) : 0;

  const lastClaimStakerOnChain = lastClaimStakerTierRaw ? Number(lastClaimStakerTierRaw as bigint) : 0;
  const lastClaimHolderOnChain = lastClaimHolderTierRaw ? Number(lastClaimHolderTierRaw as bigint) : 0;
  const lastClaimRegularOnChain = lastClaimRegularTierRaw ? Number(lastClaimRegularTierRaw as bigint) : 0;

  const lastClaimStaker = optimisticLastClaimStaker !== null
    ? Math.max(optimisticLastClaimStaker, lastClaimStakerOnChain)
    : lastClaimStakerOnChain;
  const lastClaimHolder = optimisticLastClaimHolder !== null
    ? Math.max(optimisticLastClaimHolder, lastClaimHolderOnChain)
    : lastClaimHolderOnChain;
  const lastClaimRegular = optimisticLastClaimRegular !== null
    ? Math.max(optimisticLastClaimRegular, lastClaimRegularOnChain)
    : lastClaimRegularOnChain;

  const secondsUntilStaker = stakerTierCooldown === 0 ? 0 : Math.max(0, lastClaimStaker + stakerTierCooldown - nowSec);
  const secondsUntilHolder = holderTierCooldown === 0 ? 0 : Math.max(0, lastClaimHolder + holderTierCooldown - nowSec);
  const secondsUntilRegular = regularTierCooldown === 0 ? 0 : Math.max(0, lastClaimRegular + regularTierCooldown - nowSec);

  const canClaimWithFeesStaker = secondsUntilStaker === 0;
  const canClaimWithFeesHolder = secondsUntilHolder === 0;
  const canClaimWithFeesRegular = secondsUntilRegular === 0;

  // User's on-chain category
  const userCategory = (() => {
    if (userCategoryRaw === undefined) return null;
    const val = Number(userCategoryRaw as unknown);
    return val as unknown as TierCategory;
  })();

  // ── Write contracts ─────────────────────────────────────────────────────

  const { writeContract: writeClaim, data: claimTxHash, isPending: isClaimPending, error: claimWriteError } = useWriteContract();
  const { writeContract: writeClaimWithFees, data: claimWithFeesTxHash, isPending: isClaimWithFeesPending, error: claimWithFeesWriteError } = useWriteContract();

  const { isLoading: isClaimConfirming, isSuccess: isClaimSuccess } = useWaitForTransactionReceipt({ hash: claimTxHash });
  const { isLoading: isClaimWithFeesConfirming, isSuccess: isClaimWithFeesSuccess } = useWaitForTransactionReceipt({ hash: claimWithFeesTxHash });

  // ── Actions ─────────────────────────────────────────────────────────────

  const executeClaim = useCallback(() => {
    writeClaim({
      address: SHELLIES_POINTS_ADDRESS,
      abi: SHELLIES_POINTS_CONTRACT.abi,
      functionName: 'claim',
    });
  }, [writeClaim]);

  const executeClaimWithFeesStaker = useCallback(() => {
    setPendingPaidTier('staker');
    writeClaimWithFees({
      address: SHELLIES_POINTS_ADDRESS,
      abi: SHELLIES_POINTS_CONTRACT.abi,
      functionName: 'claimWithFees',
      value: stakerTierCost,
    });
  }, [writeClaimWithFees, stakerTierCost]);

  const executeClaimWithFeesHolder = useCallback(() => {
    setPendingPaidTier('holder');
    writeClaimWithFees({
      address: SHELLIES_POINTS_ADDRESS,
      abi: SHELLIES_POINTS_CONTRACT.abi,
      functionName: 'claimWithFees',
      value: holderTierCost,
    });
  }, [writeClaimWithFees, holderTierCost]);

  const executeClaimWithFeesRegular = useCallback(() => {
    setPendingPaidTier('regular');
    writeClaimWithFees({
      address: SHELLIES_POINTS_ADDRESS,
      abi: SHELLIES_POINTS_CONTRACT.abi,
      functionName: 'claimWithFees',
      value: regularTierCost,
    });
  }, [writeClaimWithFees, regularTierCost]);

  const refreshClaimStatus = useCallback(() => {
    refetchLastClaim();
    refetchStaker();
    refetchHolder();
    refetchRegular();
  }, [refetchLastClaim, refetchStaker, refetchHolder, refetchRegular]);

  // Auto-refetch on-chain state after successful claims so the UI reflects
  // the new cooldown immediately without requiring a manual page refresh.
  useEffect(() => {
    if (isClaimSuccess) {
      setOptimisticLastClaim(nowSec);
      refetchLastClaim();
    }
  // nowSec is recalculated each render — intentionally not in deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClaimSuccess, refetchLastClaim]);

  // Clear the optimistic timestamp once the refetch returns fresh on-chain data.
  // Allow ~30s of slack because block timestamps trail local clock by a few seconds.
  useEffect(() => {
    if (optimisticLastClaim !== null && lastClaimOnChain >= optimisticLastClaim - 30) {
      setOptimisticLastClaim(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastClaimOnChain]);

  useEffect(() => {
    if (!isClaimWithFeesSuccess) return;
    const ts = Math.floor(Date.now() / 1000);
    if (pendingPaidTier === 'staker') setOptimisticLastClaimStaker(ts);
    else if (pendingPaidTier === 'holder') setOptimisticLastClaimHolder(ts);
    else if (pendingPaidTier === 'regular') setOptimisticLastClaimRegular(ts);
    setPendingPaidTier(null);
    refetchStaker();
    refetchHolder();
    refetchRegular();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClaimWithFeesSuccess]);

  useEffect(() => {
    if (optimisticLastClaimStaker !== null && lastClaimStakerOnChain >= optimisticLastClaimStaker - 30) {
      setOptimisticLastClaimStaker(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastClaimStakerOnChain]);

  useEffect(() => {
    if (optimisticLastClaimHolder !== null && lastClaimHolderOnChain >= optimisticLastClaimHolder - 30) {
      setOptimisticLastClaimHolder(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastClaimHolderOnChain]);

  useEffect(() => {
    if (optimisticLastClaimRegular !== null && lastClaimRegularOnChain >= optimisticLastClaimRegular - 30) {
      setOptimisticLastClaimRegular(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastClaimRegularOnChain]);

  // Legacy alias
  const claiming = isClaimPending || isClaimConfirming || isClaimWithFeesPending || isClaimWithFeesConfirming;

  return {
    // Free claim
    canClaim,
    secondsUntilClaim,
    claimCooldown,
    isClaimPending,
    isClaimConfirming,
    isClaimSuccess,
    claimTxHash,
    claimWriteError,
    executeClaim,

    // Tier config
    stakerTierCost,
    holderTierCost,
    regularTierCost,
    stakerTierCooldown,
    holderTierCooldown,
    regularTierCooldown,
    pointsPerStakedNFT: pointsPerStakedNFT ? Number(pointsPerStakedNFT as bigint) : 0,
    pointsPerAvailableNFT: pointsPerAvailableNFT ? Number(pointsPerAvailableNFT as bigint) : 0,
    pointsPerHeldNFT: pointsPerHeldNFT ? Number(pointsPerHeldNFT as bigint) : 0,
    pointsPerDailyStakedNFT: pointsPerDailyStakedNFT ? Number(pointsPerDailyStakedNFT as bigint) : 0,
    pointsPerWeeklyStakedNFT: pointsPerWeeklyStakedNFT ? Number(pointsPerWeeklyStakedNFT as bigint) : 0,
    pointsPerMonthlyStakedNFT: pointsPerMonthlyStakedNFT ? Number(pointsPerMonthlyStakedNFT as bigint) : 0,
    pointsForRegularUser: pointsForRegularUser ? Number(pointsForRegularUser as bigint) : 0,
    rewardPerRegularUser: rewardPerRegularUser ? Number(rewardPerRegularUser as bigint) : 0,

    // Paid claim per tier
    canClaimWithFeesStaker,
    secondsUntilStaker,
    canClaimWithFeesHolder,
    secondsUntilHolder,
    canClaimWithFeesRegular,
    secondsUntilRegular,

    // User category
    userCategory,

    // Write functions
    executeClaimWithFeesStaker,
    executeClaimWithFeesHolder,
    executeClaimWithFeesRegular,

    // Tx state
    isClaimWithFeesPending,
    isClaimWithFeesConfirming,
    isClaimWithFeesSuccess,
    claimWithFeesTxHash,
    claimWithFeesWriteError,

    // Loading
    isLoadingClaimStatus,

    // Refresh
    refreshClaimStatus,

    // Legacy
    claiming,
    claimStatus: {
      canClaim,
      secondsUntilNextClaim: secondsUntilClaim,
    },
  };
}