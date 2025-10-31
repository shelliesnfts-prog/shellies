'use client';

import '@rainbow-me/rainbowkit/styles.css';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { RainbowKitSiweNextAuthProvider, GetSiweMessageOptions } from '@rainbow-me/rainbowkit-siwe-next-auth';
import { WagmiProvider, useAccount } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import { getConfig, inkChain } from '@/lib/wagmi';
import { Session } from 'next-auth';
import { useAccountMonitor } from '@/hooks/useAccountMonitor';
import { useMemo } from 'react';

// Create QueryClient inside the component to ensure proper reactivity
const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      // Disable caching for all queries by default
      staleTime: 0,
      gcTime: 0, // Previously cacheTime in v4
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      refetchOnReconnect: true,
    },
  },
});

const getSiweMessageOptions: GetSiweMessageOptions = () => ({
  statement: 'Sign in to Shellies Raffles to access your portal and manage your points.',
  domain: typeof window !== 'undefined' ? window.location.host : 'localhost:3000',
  uri: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
  // This ensures the SIWE message always references the Ink chain
  // Users can sign on any network, but will be prompted to switch after
});

// Component to handle account monitoring inside the providers
function AccountMonitorWrapper({ children }: { children: React.ReactNode }) {
  useAccountMonitor();
  return <>{children}</>;
}

export function Web3Providers({
  children,
  session
}: {
  children: React.ReactNode;
  session?: Session | null;
}) {
  // Get config only on client side
  const config = useMemo(() => getConfig(), []);
  const queryClient = useMemo(() => createQueryClient(), []);
  
  return (
    <WagmiProvider config={config} reconnectOnMount={true}>
      <QueryClientProvider client={queryClient}>
        <SessionProvider session={session}>
          <RainbowKitSiweNextAuthProvider getSiweMessageOptions={getSiweMessageOptions}>
            <RainbowKitProvider initialChain={inkChain}>
              <AccountMonitorWrapper>
                {children}
              </AccountMonitorWrapper>
            </RainbowKitProvider>
          </RainbowKitSiweNextAuthProvider>
        </SessionProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}