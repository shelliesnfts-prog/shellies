import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { User } from '@/lib/supabase';

export function useUser() {
  const { data: session, status } = useSession();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Prevent multiple simultaneous requests
  const fetchingRef = useRef(false);

  // Fetch user data with deduplication
  const fetchUser = useCallback(async () => {
    // Don't fetch if already loading, no session, or still loading session
    if (fetchingRef.current || status === 'loading') return;
    
    if (!session?.address) {
      setUser(null);
      setLoading(false);
      setError(null);
      return;
    }

    // Only skip if address hasn't changed and we're already loading
    // Remove the aggressive caching to always allow fresh data fetching

    try {
      fetchingRef.current = true;
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/user?_t=${Date.now()}&_r=${Math.random()}`, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        cache: 'no-store'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch user data');
      }
      
      const userData = await response.json();
      setUser(userData);
    } catch (err) {
      console.error('Error fetching user:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch user data');
      setUser(null);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [session?.address, status]);

  // Force refresh user data
  const refetchUser = useCallback(async () => {
    if (!session?.address || status !== 'authenticated') return;
    
    try {
      fetchingRef.current = true;
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/user?_t=${Date.now()}&_r=${Math.random()}`, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        cache: 'no-store'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch user data');
      }
      
      const userData = await response.json();
      setUser(userData);
    } catch (err) {
      console.error('Error refetching user:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch user data');
      setUser(null);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [session?.address, status]);

  // Claim daily points
  const claimDailyPoints = async (pointsToAdd: number) => {
    if (!session?.address) return false;

    try {
      const response = await fetch('/api/user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'claim_daily',
          points: pointsToAdd,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to claim daily points');
      }

      const updatedUser = await response.json();
      setUser(updatedUser);
      return true;
    } catch (err) {
      console.error('Error claiming daily points:', err);
      setError(err instanceof Error ? err.message : 'Failed to claim points');
      return false;
    }
  };

  // Update NFT count
  const updateNFTCount = async (nftCount: number) => {
    if (!session?.address) return false;

    try {
      const response = await fetch('/api/user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'update_nft_count',
          nftCount,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update NFT count');
      }

      const updatedUser = await response.json();
      setUser(updatedUser);
      return true;
    } catch (err) {
      console.error('Error updating NFT count:', err);
      setError(err instanceof Error ? err.message : 'Failed to update NFT count');
      return false;
    }
  };

  // Check if user can claim daily points
  const canClaimDaily = user?.last_claim 
    ? (() => {
        const lastClaimDate = new Date(user.last_claim);
        const now = new Date();
        const hoursSinceLastClaim = (now.getTime() - lastClaimDate.getTime()) / (1000 * 60 * 60);
        return hoursSinceLastClaim >= 24;
      })()
    : true;

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // Refetch user data when window regains focus (common pattern for fresh data)
  useEffect(() => {
    const handleFocus = () => {
      if (session?.address && !fetchingRef.current) {
        fetchUser();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchUser, session?.address]);

  return {
    user,
    loading,
    error,
    fetchUser,
    refetchUser,
    claimDailyPoints,
    updateNFTCount,
    canClaimDaily,
  };
}