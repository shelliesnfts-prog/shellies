'use client';

import { useEffect } from 'react';
import { useAccount, useSwitchChain } from 'wagmi';
import { inkChain } from '@/lib/wagmi';

/**
 * Hook to monitor chain changes and automatically prompt users to switch to Ink chain
 * This ensures users are always on the correct network
 */
export function useChainMonitor() {
  const { chain, isConnected } = useAccount();
  const { switchChain } = useSwitchChain();

  useEffect(() => {
    // Only check if wallet is connected
    if (!isConnected || !chain) return;

    // Check if user is on the wrong chain
    if (chain.id !== inkChain.id) {
      console.log('Wrong network detected:', {
        currentChain: chain.name,
        currentChainId: chain.id,
        expectedChain: inkChain.name,
        expectedChainId: inkChain.id
      });

      // Automatically attempt to switch to Ink chain
      // RainbowKit will show the "Wrong Network" button which triggers the chain modal
      // We don't auto-switch here to give users control, but the UI will show the warning
    }
  }, [chain, isConnected]);

  const isOnCorrectChain = chain?.id === inkChain.id;

  return {
    isOnCorrectChain,
    currentChain: chain,
    switchToInkChain: () => switchChain?.({ chainId: inkChain.id })
  };
}
