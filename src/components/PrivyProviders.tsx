'use client';

import '@rainbow-me/rainbowkit/styles.css';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { RainbowKitSiweNextAuthProvider, GetSiweMessageOptions } from '@rainbow-me/rainbowkit-siwe-next-auth';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import { config } from '@/lib/wagmi';
import { Session } from 'next-auth';

const queryClient = new QueryClient();

const getSiweMessageOptions: GetSiweMessageOptions = () => ({
  statement: 'Sign in to Shellies Raffles to access your portal and manage your points.',
});

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
              {children}
            </RainbowKitProvider>
          </RainbowKitSiweNextAuthProvider>
        </QueryClientProvider>
      </SessionProvider>
    </WagmiProvider>
  );
}