import { useState, useEffect, useCallback, useRef } from 'react';
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

interface DashboardData {
  user: User;
  claimStatus: ClaimStatus;
}

interface ClaimResult {
  success: boolean;
  message?: string;
  newPoints?: number;
  pointsAdded?: number;
  nftCount?: number;
  error?: string;
}

export function useDashboard() {
  const { data: session, status } = useSession();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Prevent multiple simultaneous requests
  const fetchingRef = useRef(false);
  const lastAddressRef = useRef<string | null>(null);

  // Fetch combined dashboard data
  const fetchDashboard = useCallback(async () => {
    // Don't fetch if already loading, no session, or still loading session
    if (fetchingRef.current || status === 'loading') return;
    
    if (!session?.address) {
      setDashboardData(null);
      setLoading(false);
      setError(null);
      lastAddressRef.current = null;
      return;
    }

    // Don't refetch if it's the same address and we already have data
    if (lastAddressRef.current === session.address && dashboardData && !error) {
      setLoading(false);
      return;
    }

    try {
      fetchingRef.current = true;
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/dashboard');
      
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }
      
      const data = await response.json();
      setDashboardData(data);
      lastAddressRef.current = session.address;
    } catch (err) {
      console.error('Error fetching dashboard:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch dashboard data');
      setDashboardData(null);
      lastAddressRef.current = null;
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [session?.address, status, dashboardData, error]);

  // Execute claim
  const executeClaim = useCallback(async (): Promise<ClaimResult> => {
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

      // Update dashboard data after successful claim
      setDashboardData(prev => prev ? {
        ...prev,
        user: {
          ...prev.user,
          points: result.newPoints,
          last_claim: new Date().toISOString()
        },
        claimStatus: {
          ...prev.claimStatus,
          canClaim: false,
          secondsUntilNextClaim: result.nextClaimIn / 1000,
          currentPoints: result.newPoints,
          lastClaim: new Date().toISOString()
        }
      } : null);

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to process claim';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setClaiming(false);
    }
  }, [session?.address, claiming]);

  // Manual refresh
  const refreshDashboard = useCallback(() => {
    lastAddressRef.current = null; // Force refetch
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Periodic refresh only when user can't claim (less frequent)
  useEffect(() => {
    if (!dashboardData?.claimStatus.canClaim) {
      const interval = setInterval(() => {
        fetchDashboard();
      }, 5 * 60 * 1000); // 5 minutes

      return () => clearInterval(interval);
    }
  }, [dashboardData?.claimStatus.canClaim, fetchDashboard]);

  return {
    user: dashboardData?.user || null,
    claimStatus: dashboardData?.claimStatus || null,
    loading,
    claiming,
    error,
    executeClaim,
    refreshDashboard,
    fetchUser: refreshDashboard, // Alias for backward compatibility
  };
}