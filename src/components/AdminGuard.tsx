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
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-8 border border-white/20 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400 mx-auto mb-4"></div>
          <p className="text-white">Checking admin privileges...</p>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated' || !isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-8 border border-white/20 text-center max-w-md">
          <div className="text-6xl mb-6">🚫</div>
          <h2 className="text-3xl font-bold text-white mb-6">Access Denied</h2>
          <p className="text-gray-300 mb-8">
            You need admin privileges to access this page.
          </p>
          <div className="space-y-4">
            <button
              onClick={() => router.push('/portal')}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-8 py-4 rounded-lg font-bold text-lg transition-all duration-200 transform hover:scale-105 shadow-lg"
            >
              Go to Portal
            </button>
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

  return <>{children}</>;
}