'use client';

import { useEffect, useRef } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { useSession } from 'next-auth/react';

/**
 * Hook to synchronize wallet connection state with NextAuth session
 * Ensures wallet stays connected when a valid session exists
 */
export function useWalletSync() {
  const { address, isConnected, connector } = useAccount();
  const { data: session, status } = useSession();
  const { connectAsync, connectors } = useConnect();
  const hasAttemptedReconnect = useRef(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;

    // Skip if session is loading
    if (status === 'loading') return;

    const sessionAddress = session?.address?.toLowerCase();
    const currentAddress = address?.toLowerCase();

    // Case 1: Session exists but wallet is not connected
    // Attempt to reconnect the wallet automatically
    if (
      sessionAddress &&
      !isConnected &&
      !hasAttemptedReconnect.current &&
      status === 'authenticated'
    ) {
      console.log('Session exists but wallet disconnected. Attempting auto-reconnect...');
      hasAttemptedReconnect.current = true;

      // Clear any existing timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      // Attempt reconnection after a short delay
      reconnectTimeoutRef.current = setTimeout(async () => {
        try {
          // Try to find the last used connector from localStorage
          const lastConnectorId = window.localStorage.getItem('recentConnectorId');
          const targetConnector = lastConnectorId
            ? connectors.find(c => c.id === lastConnectorId)
            : connectors[0]; // Fallback to first available connector

          if (targetConnector) {
            console.log('Attempting to reconnect with connector:', targetConnector.name);
            await connectAsync({ connector: targetConnector });
            console.log('Wallet reconnected successfully');
          }
        } catch (error) {
          console.warn('Auto-reconnect failed:', error);
          // Don't throw error, just log it - user can manually reconnect
        }
      }, 500);
    }

    // Case 2: Wallet connected but addresses don't match
    // This is handled by useAccountMonitor, but we log it here for visibility
    if (
      sessionAddress &&
      currentAddress &&
      isConnected &&
      sessionAddress !== currentAddress
    ) {
      console.warn('Wallet address mismatch:', {
        session: sessionAddress,
        wallet: currentAddress
      });
    }

    // Case 3: Wallet connected and matches session - all good!
    if (
      sessionAddress &&
      currentAddress &&
      isConnected &&
      sessionAddress === currentAddress
    ) {
      // Reset reconnect flag when successfully connected
      hasAttemptedReconnect.current = false;
    }

    // Cleanup timeout on unmount
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [address, isConnected, session, status, connectAsync, connectors]);

  // Store the connector ID when wallet connects
  useEffect(() => {
    if (connector && isConnected) {
      window.localStorage.setItem('recentConnectorId', connector.id);
    }
  }, [connector, isConnected]);

  return {
    isSynced: session?.address?.toLowerCase() === address?.toLowerCase(),
    sessionAddress: session?.address,
    walletAddress: address,
    isConnected,
  };
}
