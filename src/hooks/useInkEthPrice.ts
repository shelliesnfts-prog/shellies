'use client';

import { useState, useEffect } from 'react';

const DEFILLAMA_URL =
  'https://coins.llama.fi/prices/current/ink:0x4200000000000000000000000000000000000006';

let cached: { price: number; at: number } | null = null;
const CACHE_MS = 5 * 60 * 1000; // 5 minutes

export function useInkEthPrice() {
  const [ethPrice, setEthPrice] = useState<number | null>(
    cached && Date.now() - cached.at < CACHE_MS ? cached.price : null
  );
  const [loading, setLoading] = useState(!ethPrice);

  useEffect(() => {
    if (cached && Date.now() - cached.at < CACHE_MS) {
      setEthPrice(cached.price);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetch(DEFILLAMA_URL)
      .then(r => r.json())
      .then(data => {
        const coin = data?.coins?.['ink:0x4200000000000000000000000000000000000006'];
        if (coin && typeof coin.price === 'number' && coin.price > 0) {
          cached = { price: coin.price, at: Date.now() };
          if (!cancelled) setEthPrice(coin.price);
        }
      })
      .catch(() => {/* silently fail — UI will just show ETH fallback */})
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, []);

  return { ethPrice, loading };
}
