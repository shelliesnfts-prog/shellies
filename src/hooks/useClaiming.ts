import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

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
  error?: string;
}

export function useClaiming() {
  const { data: session, status } = useSession();
  const [claimStatus, setClaimStatus] = useState<ClaimStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch claim status
  const fetchClaimStatus = useCallback(async () => {
    if (status === 'loading' || !session?.address) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/claim');
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch claim status');
      }

      const data = await response.json();
      setClaimStatus(data);
    } catch (err) {
      console.error('Error fetching claim status:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch claim status');
    } finally {
      setLoading(false);
    }
  }, [session?.address, status]);

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

      // Update claim status after successful claim
      setClaimStatus(prev => prev ? {
        ...prev,
        canClaim: false,
        secondsUntilNextClaim: result.nextClaimIn / 1000, // Convert to seconds
        currentPoints: result.newPoints,
        lastClaim: new Date().toISOString()
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

  // Auto-refresh claim status (less frequent to reduce load)
  useEffect(() => {
    fetchClaimStatus();
    
    // Set up periodic refresh every 5 minutes when user can't claim
    const interval = setInterval(() => {
      if (claimStatus && !claimStatus.canClaim) {
        fetchClaimStatus();
      }
    }, 5 * 60 * 1000); // 5 minutes instead of 30 seconds

    return () => clearInterval(interval);
  }, [fetchClaimStatus, claimStatus?.canClaim]);

  // Manual refresh function
  const refreshClaimStatus = useCallback(() => {
    fetchClaimStatus();
  }, [fetchClaimStatus]);

  return {
    claimStatus,
    loading,
    claiming,
    error,
    executeClaim,
    refreshClaimStatus,
  };
}