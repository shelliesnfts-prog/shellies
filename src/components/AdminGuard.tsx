'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';

interface AdminGuardProps {
  children: React.ReactNode;
}

export function AdminGuard({ children }: AdminGuardProps) {
  const { data: session, status } = useSession();
  const { address } = useAccount();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  // Get wallet address from session or wagmi
  const walletAddress = address || session?.address || '';

  const checkAdminStatus = async () => {
    if (status === 'loading') return;
    
    if (!walletAddress || status === 'unauthenticated') {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/admin/check');
      const data = await response.json();
      
      setIsAdmin(data.isAdmin || false);
    } catch (error) {
      console.error('Error checking admin status:', error);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAdminStatus();
  }, [walletAddress, status]);

  useEffect(() => {
    if (!loading) {
      if (status === 'unauthenticated' || !isAdmin) {
        router.push('/');
      }
    }
  }, [loading, status, isAdmin, router]);

  if (loading || status === 'loading') {
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

  if (status === 'unauthenticated' || !isAdmin) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="w-10 h-10 rounded-full border border-red-500/20 flex items-center justify-center mx-auto">
            <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white mb-2">Access Denied</h2>
            <p className="text-sm text-gray-400">
              Admin privileges are required to view this page.
            </p>
          </div>
          <div className="space-y-3">
            <button
              onClick={() => router.push('/portal')}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
            >
              Go to Portal
            </button>
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

  return <>{children}</>;
}