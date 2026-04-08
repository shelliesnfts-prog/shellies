'use client';

import { useCallback } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { SHELLIES_POINTS_CONTRACT, SHELLIES_POINTS_ADDRESS } from '@/lib/shellies-points-contract';

export function useClaiming() {
  const { address } = useAccount();

  // ── On-chain reads ───────────────────────────────────────────────────────

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

  const { data: lastClaimWithFeesRaw, refetch: refetchLastClaimWithFees, isLoading: isLoadingLastClaimWithFees, isFetching: isFetchingLastClaimWithFees } = useReadContract({
    address: SHELLIES_POINTS_ADDRESS,
    abi: SHELLIES_POINTS_CONTRACT.abi,
    functionName: 'lastClaimWithFees',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: claimWithFeesCooldownRaw } = useReadContract({
    address: SHELLIES_POINTS_ADDRESS,
    abi: SHELLIES_POINTS_CONTRACT.abi,
    functionName: 'claimWithFeesCooldown',
  });

  const {
    data: claimWithFeesCostRaw,
    isLoading: isLoadingCost,
    isError: isErrorCost,
  } = useReadContract({
    address: SHELLIES_POINTS_ADDRESS,
    abi: SHELLIES_POINTS_CONTRACT.abi,
    functionName: 'claimWithFeesCost',
  });

  const {
    data: claimWithFeesRewardRaw,
    isLoading: isLoadingReward,
    isError: isErrorReward,
  } = useReadContract({
    address: SHELLIES_POINTS_ADDRESS,
    abi: SHELLIES_POINTS_CONTRACT.abi,
    functionName: 'claimWithFeesReward',
  });

  // ── Derived cooldown state ───────────────────────────────────────────────

  const nowSec = Math.floor(Date.now() / 1000);

  // True while the per-address cooldown data is still being fetched (e.g. after wallet switch)
  const isLoadingClaimStatus = isLoadingLastClaim || isFetchingLastClaim;
  const isLoadingClaimWithFeesStatus = isLoadingLastClaimWithFees || isFetchingLastClaimWithFees;

  const lastClaim = lastClaimRaw ? Number(lastClaimRaw as bigint) : 0;
  const claimCooldown = claimCooldownRaw ? Number(claimCooldownRaw as bigint) : 86400;
  const secondsUntilClaim = Math.max(0, lastClaim + claimCooldown - nowSec);
  // Gate canClaim to false while loading to avoid a false-ready state during wallet switches
  const canClaim = !isLoadingClaimStatus && secondsUntilClaim === 0;

  const lastClaimWithFees = lastClaimWithFeesRaw ? Number(lastClaimWithFeesRaw as bigint) : 0;
  const claimWithFeesCooldown = claimWithFeesCooldownRaw ? Number(claimWithFeesCooldownRaw as bigint) : 0;
  const secondsUntilClaimWithFees = claimWithFeesCooldown === 0
    ? 0
    : Math.max(0, lastClaimWithFees + claimWithFeesCooldown - nowSec);
  const canClaimWithFees = !isLoadingClaimWithFeesStatus && secondsUntilClaimWithFees === 0;

  const claimWithFeesCost = (claimWithFeesCostRaw as bigint | undefined) ?? BigInt(0);
  const claimWithFeesReward = claimWithFeesRewardRaw ? Number(claimWithFeesRewardRaw as bigint) : 0;

  // True while the cost/reward values are still resolving from the chain
  const isLoadingPaidClaimConfig = isLoadingCost || isLoadingReward;
  // True only after loading is complete and both values are non-zero (admin has configured it)
  const isPaidClaimConfigured =
    !isLoadingPaidClaimConfig &&
    !isErrorCost &&
    !isErrorReward &&
    claimWithFeesCost > BigInt(0) &&
    claimWithFeesReward > 0;

  // ── Write contracts ──────────────────────────────────────────────────────

  const {
    writeContract: writeClaimContract,
    data: claimTxHash,
    isPending: isClaimPending,
    error: claimWriteError,
  } = useWriteContract();

  const {
    writeContract: writeClaimWithFeesContract,
    data: claimWithFeesTxHash,
    isPending: isClaimWithFeesPending,
    error: claimWithFeesWriteError,
  } = useWriteContract();

  const { isLoading: isClaimConfirming, isSuccess: isClaimSuccess } =
    useWaitForTransactionReceipt({ hash: claimTxHash });

  const { isLoading: isClaimWithFeesConfirming, isSuccess: isClaimWithFeesSuccess } =
    useWaitForTransactionReceipt({ hash: claimWithFeesTxHash });

  // ── Claim actions ────────────────────────────────────────────────────────

  const executeClaim = useCallback(() => {
    writeClaimContract({
      address: SHELLIES_POINTS_ADDRESS,
      abi: SHELLIES_POINTS_CONTRACT.abi,
      functionName: 'claim',
    });
  }, [writeClaimContract]);

  const executeClaimWithFees = useCallback(() => {
    writeClaimWithFeesContract({
      address: SHELLIES_POINTS_ADDRESS,
      abi: SHELLIES_POINTS_CONTRACT.abi,
      functionName: 'claimWithFees',
      value: claimWithFeesCost,
    });
  }, [writeClaimWithFeesContract, claimWithFeesCost]);

  const refreshClaimStatus = useCallback(() => {
    refetchLastClaim();
    refetchLastClaimWithFees();
  }, [refetchLastClaim, refetchLastClaimWithFees]);

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

    // Paid claim
    canClaimWithFees,
    secondsUntilClaimWithFees,
    claimWithFeesCost,
    claimWithFeesReward,
    isClaimWithFeesPending,
    isClaimWithFeesConfirming,
    isClaimWithFeesSuccess,
    claimWithFeesTxHash,
    claimWithFeesWriteError,
    executeClaimWithFees,
    isLoadingPaidClaimConfig,
    isPaidClaimConfigured,

    // Loading state (true while per-address data is re-fetching, e.g. after wallet switch)
    isLoadingClaimStatus,

    // Shared
    refreshClaimStatus,

    // Legacy shape aliases for PointsContext compatibility
    claiming: isClaimPending || isClaimConfirming || isClaimWithFeesPending || isClaimWithFeesConfirming,
    claimStatus: {
      canClaim,
      secondsUntilNextClaim: secondsUntilClaim,
    },
  };
}
