'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Portal() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/portal/raffles');
  }, [router]);

  return null;
}