'use client';

import { useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';
import { useSession, signOut } from 'next-auth/react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Hook to monitor wallet account changes and automatically cleanup sessions
 * when users switch accounts in their wallet extension (Metamask, Rabby, etc.)
 */
export function useAccountMonitor() {
  const { address, isConnected } = useAccount();
  const { data: session, status } = useSession();
  const queryClient = useQueryClient();

  // Track the last known address to detect changes
  const lastAddressRef = useRef<string | null>(null);
  const lastSessionAddressRef = useRef<string | null>(null);

  useEffect(() => {
    // Skip if session is still loading
    if (status === 'loading') return;

    const currentAddress = address?.toLowerCase();
    const sessionAddress = session?.address?.toLowerCase();
    const lastAddress = lastAddressRef.current?.toLowerCase();
    const lastSessionAddress = lastSessionAddressRef.current?.toLowerCase();

    // Update refs with current values
    lastAddressRef.current = currentAddress || null;
    lastSessionAddressRef.current = sessionAddress || null;

    // Scenario 1: Wallet account switched while authenticated
    if (
      lastAddress &&
      currentAddress &&
      lastAddress !== currentAddress &&
      sessionAddress &&
      currentAddress !== sessionAddress
    ) {
      console.log('Account switch detected, clearing session...', {
        oldAddress: lastAddress,
        newAddress: currentAddress,
        sessionAddress
      });

      handleAccountSwitch();
      return;
    }

    // Scenario 2: Session exists but wallet is disconnected
    if (
      sessionAddress &&
      !isConnected
    ) {
      console.log('Wallet disconnected, clearing session...');
      handleAccountSwitch();
      return;
    }

    // Scenario 3: Session address doesn't match current wallet address
    if (
      sessionAddress &&
      currentAddress &&
      sessionAddress !== currentAddress
    ) {
      console.log('Address mismatch detected, clearing session...', {
        sessionAddress,
        currentAddress
      });

      handleAccountSwitch();
      return;
    }

  }, [address, session, status, isConnected]);

  const handleAccountSwitch = async () => {
    try {
      // Clear all React Query cache to remove stale data
      queryClient.clear();

      // Clear localStorage for any cached user data
      if (typeof window !== 'undefined') {
        // Clear any app-specific cached data
        const keysToRemove = Object.keys(localStorage).filter(key =>
          key.includes('user') ||
          key.includes('points') ||
          key.includes('shellies') ||
          key.includes('raffle')
        );

        keysToRemove.forEach(key => {
          localStorage.removeItem(key);
        });

        // Clear sessionStorage as well
        const sessionKeysToRemove = Object.keys(sessionStorage).filter(key =>
          key.includes('user') ||
          key.includes('points') ||
          key.includes('shellies') ||
          key.includes('raffle')
        );

        sessionKeysToRemove.forEach(key => {
          sessionStorage.removeItem(key);
        });
      }

      // Broadcast account switch event for other components to react
      window.dispatchEvent(new CustomEvent('accountSwitched', {
        detail: {
          oldAddress: lastSessionAddressRef.current,
          newAddress: address
        }
      }));

      // Sign out to clear NextAuth session
      await signOut({
        redirect: false,
        callbackUrl: window.location.pathname
      });

    } catch (error) {
      console.error('Error during account switch cleanup:', error);

      // Fallback: Force page reload to ensure clean state
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    }
  };

  return {
    isAccountMismatch: session?.address && address &&
      session.address.toLowerCase() !== address.toLowerCase(),
    currentAddress: address,
    sessionAddress: session?.address
  };
}