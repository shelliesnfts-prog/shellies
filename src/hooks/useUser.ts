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
  const lastAddressRef = useRef<string | null>(null);

  // Fetch user data with deduplication
  const fetchUser = useCallback(async () => {
    // Don't fetch if already loading, no session, or still loading session
    if (fetchingRef.current || status === 'loading') return;
    
    if (!session?.address) {
      setUser(null);
      setLoading(false);
      setError(null);
      lastAddressRef.current = null;
      return;
    }

    // Don't refetch if it's the same address and we already have data
    if (lastAddressRef.current === session.address && user && !error) {
      setLoading(false);
      return;
    }

    try {
      fetchingRef.current = true;
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/user');
      
      if (!response.ok) {
        throw new Error('Failed to fetch user data');
      }
      
      const userData = await response.json();
      setUser(userData);
      lastAddressRef.current = session.address;
    } catch (err) {
      console.error('Error fetching user:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch user data');
      setUser(null);
      lastAddressRef.current = null;
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [session?.address, status, user, error]);

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
      lastAddressRef.current = session.address; // Update tracking
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
      lastAddressRef.current = session.address; // Update tracking
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

  return {
    user,
    loading,
    error,
    fetchUser,
    claimDailyPoints,
    updateNFTCount,
    canClaimDaily,
  };
}