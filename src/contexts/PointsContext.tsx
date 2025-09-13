'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';

interface User {
  id: string;
  wallet_address: string;
  points: number;
  last_claim: string | null;
  nft_count: number;
  created_at: string;
  updated_at: string;
}

interface ClaimStatus {
  canClaim: boolean;
  secondsUntilNextClaim: number;
  nftCount: number;
  potentialPoints: number;
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
  executeRegularClaim: () => Promise<ClaimResult>;
  executeStakingClaim: () => Promise<ClaimResult>;
  refreshUserData: () => Promise<void>;
  updatePoints: (newPoints: number) => void;
  
  // Utilities
  canPerformStaking: boolean; // Based on 24h cooldown
}

const PointsContext = createContext<PointsContextType | undefined>(undefined);

export function PointsProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [user, setUser] = useState<User | null>(null);
  const [claimStatus, setClaimStatus] = useState<ClaimStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prevent multiple simultaneous requests
  const fetchingRef = useRef(false);
  const lastAddressRef = useRef<string | null>(null);

  // Note: Staking operations are now always available (no 24h constraint)
  // The 24h cooldown only applies to points claiming, not staking/unstaking
  const canPerformStaking = true;

  // Fetch user data and claim status
  const fetchUserData = useCallback(async () => {
    if (fetchingRef.current || status === 'loading') return;
    
    if (!session?.address) {
      setUser(null);
      setClaimStatus(null);
      setLoading(false);
      setError(null);
      lastAddressRef.current = null;
      return;
    }

    // Always fetch fresh data to avoid stale cache issues
    // Removed problematic caching logic that prevented fresh data fetches

    try {
      fetchingRef.current = true;
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/dashboard');
      
      if (!response.ok) {
        throw new Error('Failed to fetch user data');
      }
      
      const data = await response.json();
      setUser(data.user);
      setClaimStatus(data.claimStatus);
      lastAddressRef.current = session.address;
    } catch (err) {
      console.error('Error fetching user data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch user data');
      setUser(null);
      setClaimStatus(null);
      lastAddressRef.current = null;
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [session?.address, status]);

  // Execute regular daily claim
  const executeRegularClaim = useCallback(async (): Promise<ClaimResult> => {
    if (!session?.address || claiming) {
      return { success: false, error: 'Not ready to claim' };
    }

    try {
      setClaiming(true);
      setError(null);

      const response = await fetch('/api/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();
      
      if (!result.success) {
        setError(result.error);
        return result;
      }

      // Clear local state to force fresh fetch and update display immediately  
      setUser(null);
      setClaimStatus(null);
      lastAddressRef.current = null; // Force refetch

      // Immediately fetch fresh data to reflect the claim
      setTimeout(() => {
        fetchUserData();
      }, 100);

      // Broadcast points update
      window.dispatchEvent(new CustomEvent('pointsUpdated', { 
        detail: { newPoints: result.newPoints, walletAddress: session.address }
      }));

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to process claim';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setClaiming(false);
    }
  }, [session?.address, claiming]);

  // Execute staking claim (10 points per staked NFT)
  const executeStakingClaim = useCallback(async (): Promise<ClaimResult> => {
    if (!session?.address || claiming) {
      return { success: false, error: 'Not ready to claim staking rewards' };
    }

    try {
      setClaiming(true);
      setError(null);

      const response = await fetch('/api/claim-staking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();
      
      if (!result.success) {
        setError(result.error);
        return result;
      }

      // Clear local state to force fresh fetch and update display immediately  
      setUser(null);
      setClaimStatus(null);
      lastAddressRef.current = null; // Force refetch

      // Immediately fetch fresh data to reflect the staking claim
      setTimeout(() => {
        fetchUserData();
      }, 100);

      // Broadcast points update
      window.dispatchEvent(new CustomEvent('pointsUpdated', { 
        detail: { newPoints: result.newPoints, walletAddress: session.address }
      }));

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to process staking claim';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setClaiming(false);
    }
  }, [session?.address, claiming]);

  // Manual refresh
  const refreshUserData = useCallback(async () => {
    lastAddressRef.current = null; // Force refetch
    await fetchUserData();
  }, [fetchUserData]);

  // Update points manually (for external updates)
  const updatePoints = useCallback((newPoints: number) => {
    setUser(prev => prev ? { ...prev, points: newPoints } : null);
    setClaimStatus(prev => prev ? { ...prev, currentPoints: newPoints } : null);
    
    // Broadcast the update
    if (session?.address) {
      window.dispatchEvent(new CustomEvent('pointsUpdated', { 
        detail: { newPoints, walletAddress: session.address }
      }));
    }
  }, [session?.address]);

  // Fetch data on mount and address change
  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  // Listen for external points updates (backward compatibility)
  useEffect(() => {
    const handlePointsUpdate = (event: CustomEvent) => {
      const { newPoints, walletAddress } = event.detail;
      
      // Only update if it's for the current user
      if (session?.address === walletAddress) {
        updatePoints(newPoints);
        
        // Also refresh full data to ensure consistency
        setTimeout(() => refreshUserData(), 1000);
      }
    };

    window.addEventListener('pointsUpdated', handlePointsUpdate as EventListener);
    
    return () => {
      window.removeEventListener('pointsUpdated', handlePointsUpdate as EventListener);
    };
  }, [session?.address, updatePoints, refreshUserData]);

  // Periodic refresh when user can't claim (less frequent)
  useEffect(() => {
    if (!claimStatus?.canClaim) {
      const interval = setInterval(() => {
        fetchUserData();
      }, 5 * 60 * 1000); // 5 minutes

      return () => clearInterval(interval);
    }
  }, [claimStatus?.canClaim, fetchUserData]);

  const value: PointsContextType = {
    // State
    user,
    claimStatus,
    loading,
    claiming,
    error,

    // Actions
    executeRegularClaim,
    executeStakingClaim,
    refreshUserData,
    updatePoints,

    // Utilities
    canPerformStaking,
  };

  return (
    <PointsContext.Provider value={value}>
      {children}
    </PointsContext.Provider>
  );
}

// Hook to use the points context
export function usePoints() {
  const context = useContext(PointsContext);
  if (context === undefined) {
    throw new Error('usePoints must be used within a PointsProvider');
  }
  return context;
}