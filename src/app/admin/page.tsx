'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to raffles page as the default admin page
    router.push('/admin/raffles');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
      <div className="flex flex-col items-center gap-6">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-purple-400 animate-[pulse_1.4s_ease-in-out_infinite]" />
          <span className="h-2 w-2 rounded-full bg-purple-400 animate-[pulse_1.4s_ease-in-out_0.2s_infinite]" />
          <span className="h-2 w-2 rounded-full bg-purple-400 animate-[pulse_1.4s_ease-in-out_0.4s_infinite]" />
        </div>
        <p className="text-sm text-gray-400 tracking-wide">Redirecting</p>
      </div>
    </div>
  );
}