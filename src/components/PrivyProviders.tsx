'use client';

import '@rainbow-me/rainbowkit/styles.css';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { RainbowKitSiweNextAuthProvider, GetSiweMessageOptions } from '@rainbow-me/rainbowkit-siwe-next-auth';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import { config } from '@/lib/wagmi';
import { Session } from 'next-auth';
import { useAccountMonitor } from '@/hooks/useAccountMonitor';

const queryClient = new QueryClient({
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
  return (
    <WagmiProvider config={config}>
      <SessionProvider session={session}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitSiweNextAuthProvider getSiweMessageOptions={getSiweMessageOptions}>
            <RainbowKitProvider>
              <AccountMonitorWrapper>
                {children}
              </AccountMonitorWrapper>
            </RainbowKitProvider>
          </RainbowKitSiweNextAuthProvider>
        </QueryClientProvider>
      </SessionProvider>
    </WagmiProvider>
  );
}