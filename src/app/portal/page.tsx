'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Portal() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/portal/profile');
  }, [router]);

  return null;
}