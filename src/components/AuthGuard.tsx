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

  // Redirect unauthenticated users
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  // Loading state
  if (status === 'loading' || isConnecting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-8 border border-white/20 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400 mx-auto mb-4"></div>
          <p className="text-white">Loading...</p>
        </div>
      </div>
    );
  }

  // Unauthenticated state
  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-8 border border-white/20 text-center max-w-md">
          <h2 className="text-3xl font-bold text-white mb-6">Access Denied</h2>
          <p className="text-gray-300 mb-8">
            You need to connect your wallet to access the portal.
          </p>
          <div className="space-y-4">
            <div className="w-full">
              <ConnectButton />
            </div>
            <button
              onClick={() => router.push('/')}
              className="w-full border-2 border-purple-400 text-purple-400 hover:bg-purple-400 hover:text-white px-8 py-4 rounded-lg font-bold text-lg transition-all duration-200"
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
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-8 border border-white/20 text-center max-w-md">
          <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">Wallet Not Connected</h2>
          <p className="text-gray-300 mb-6">
            Your session is active, but your wallet is not connected. Please reconnect your wallet to continue.
          </p>
          {address && session?.address && address.toLowerCase() !== session.address.toLowerCase() && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-6">
              <p className="text-red-300 text-sm">
                <strong>Address Mismatch:</strong><br />
                Session: {session.address.slice(0, 6)}...{session.address.slice(-4)}<br />
                Wallet: {address.slice(0, 6)}...{address.slice(-4)}
              </p>
            </div>
          )}
          <div className="space-y-4">
            <div className="w-full flex justify-center">
              <ConnectButton />
            </div>
            <button
              onClick={async () => {
                await signOut({ redirect: false });
                router.push('/');
              }}
              className="w-full border-2 border-purple-400 text-purple-400 hover:bg-purple-400 hover:text-white px-8 py-4 rounded-lg font-bold text-lg transition-all duration-200"
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