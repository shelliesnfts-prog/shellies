'use client';

import { useSession, signOut } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { data: session, status } = useSession();
  const { address, isConnected, isConnecting } = useAccount();
  const router = useRouter();
  const [showWalletWarning, setShowWalletWarning] = useState(false);

  // Check if session exists but wallet is not connected
  useEffect(() => {
    if (status === 'authenticated' && session?.address && !isConnecting) {
      // Session exists but wallet is not connected
      if (!isConnected || !address) {
        setShowWalletWarning(true);
      } 
      // Session address doesn't match connected wallet
      else if (address.toLowerCase() !== session.address.toLowerCase()) {
        console.warn('Wallet address mismatch detected');
        setShowWalletWarning(true);
      } else {
        setShowWalletWarning(false);
      }
    }
  }, [status, session, isConnected, address, isConnecting]);

  // Loading state
  if (status === 'loading' || isConnecting) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-6">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-purple-400 animate-[pulse_1.4s_ease-in-out_infinite]" />
            <span className="h-2 w-2 rounded-full bg-purple-400 animate-[pulse_1.4s_ease-in-out_0.2s_infinite]" />
            <span className="h-2 w-2 rounded-full bg-purple-400 animate-[pulse_1.4s_ease-in-out_0.4s_infinite]" />
          </div>
          <p className="text-sm text-gray-400 tracking-wide">Loading</p>
        </div>
      </div>
    );
  }

  // Unauthenticated state
  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center mx-auto">
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white mb-2">Wallet Required</h2>
            <p className="text-sm text-gray-400">
              Connect your wallet to access the portal.
            </p>
          </div>
          <div className="space-y-3">
            <div className="w-full flex justify-center">
              <ConnectButton />
            </div>
            <button
              onClick={() => router.push('/')}
              className="w-full text-sm text-gray-500 hover:text-gray-300 py-2 transition-colors"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Wallet disconnected warning
  if (showWalletWarning) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="w-10 h-10 rounded-full border border-yellow-500/30 flex items-center justify-center mx-auto">
            <svg className="w-5 h-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white mb-2">Wallet Not Connected</h2>
            <p className="text-sm text-gray-400">
              Your session is active but your wallet is disconnected. Reconnect to continue.
            </p>
          </div>
          {address && session?.address && address.toLowerCase() !== session.address.toLowerCase() && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3">
              <p className="text-xs text-red-400">
                <span className="font-medium">Address mismatch</span><br />
                Session: {session.address.slice(0, 6)}...{session.address.slice(-4)}<br />
                Wallet: {address.slice(0, 6)}...{address.slice(-4)}
              </p>
            </div>
          )}
          <div className="space-y-3">
            <div className="w-full flex justify-center">
              <ConnectButton />
            </div>
            <button
              onClick={async () => {
                await signOut({ redirect: false });
                router.push('/');
              }}
              className="w-full text-sm text-gray-500 hover:text-gray-300 py-2 transition-colors"
            >
              Sign Out & Go Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}