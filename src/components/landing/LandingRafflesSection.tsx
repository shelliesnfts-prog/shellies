'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Gift } from 'lucide-react';
import { Raffle } from '@/lib/supabase';
import { LandingRaffleCard } from '@/components/landing/LandingRaffleCard';
import { fadeUp, stagger } from '@/app/_landing-motion';

function RaffleCardSkeleton() {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0f0720]/80 overflow-hidden animate-pulse">
      <div className="aspect-square bg-white/5" />
      <div className="p-5 space-y-3 border-t border-white/10 bg-white/[0.02]">
        <div className="h-4 bg-white/10 rounded w-3/4" />
        <div className="flex justify-between">
          <div className="h-3 bg-white/10 rounded w-1/4" />
          <div className="h-3 bg-white/10 rounded w-1/3" />
        </div>
        <div className="flex justify-between pt-2 border-t border-white/8">
          <div className="h-3 bg-white/10 rounded w-1/4" />
          <div className="h-3 bg-white/10 rounded w-1/5" />
        </div>
      </div>
    </div>
  );
}

export function LandingRafflesSection() {
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const cancelledRef = useRef(false);

  const fetchRaffles = useCallback(async () => {
    cancelledRef.current = false;
    try {
      const response = await fetch('/api/raffles?status=all&page=1&limit=3');
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      if (!cancelledRef.current) {
        setRaffles(data.raffles ?? []);
        setError(false);
      }
    } catch {
      if (!cancelledRef.current) {
        setError(true);
        setRaffles([]);
      }
    } finally {
      if (!cancelledRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const handleRetry = () => {
    setError(false);
    setLoading(true);
    fetchRaffles();
  };

  useEffect(() => {
    fetchRaffles();
    return () => { cancelledRef.current = true; };
  }, [fetchRaffles]);

  return (
    <section id="raffles" className="relative py-20 px-6 border-t border-white/8">
      {/* Dot grid background */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.12]"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(168,85,247,0.5) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Section header */}
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
          variants={stagger}
          className="mb-10"
        >
          <motion.p
            variants={fadeUp}
            className="text-sm font-medium text-purple-400 mb-4 tracking-widest uppercase"
          >
            Live on chain
          </motion.p>

          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div>
              <motion.h2
                variants={fadeUp}
                className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-3"
              >
                Active raffles
              </motion.h2>
              <motion.p
                variants={fadeUp}
                className="text-gray-400 max-w-md"
              >
                Spend points, win NFTs and tokens. New raffles drop weekly.
              </motion.p>
            </div>

            {/* Desktop "View all" */}
            <motion.div variants={fadeUp} className="hidden lg:block shrink-0">
              <Link
                href="/portal/raffles"
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-gray-300 hover:text-white border border-white/15 hover:border-white/30 rounded-xl transition-colors"
              >
                View all
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </motion.div>
          </div>
        </motion.div>

        {/* Content */}
        <motion.div
          key={loading ? 'loading' : 'loaded'}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-60px' }}
          variants={stagger}
        >
          {loading ? (
            /* Skeleton grid — 3 cards matching final dimensions */
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {[0, 1, 2].map((i) => (
                <motion.div key={i} variants={fadeUp}>
                  <RaffleCardSkeleton />
                </motion.div>
              ))}
            </div>
          ) : error ? (
            /* Error state */
            <motion.div
              variants={fadeUp}
              className="text-center py-16 rounded-2xl border border-white/10 bg-white/[0.02]"
            >
              <div className="w-14 h-14 rounded-xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <Gift className="w-7 h-7 text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Failed to load raffles
              </h3>
              <p className="text-sm text-gray-400 mb-6">
                Something went wrong. Check your connection and try again.
              </p>
              <button
                onClick={handleRetry}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-xl transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Retry
              </button>
            </motion.div>
          ) : raffles.length === 0 ? (
            /* Empty state */
            <motion.div
              variants={fadeUp}
              className="text-center py-16 rounded-2xl border border-white/10 bg-white/[0.02]"
            >
              <div className="w-14 h-14 rounded-xl bg-purple-500/10 flex items-center justify-center mx-auto mb-4">
                <Gift className="w-7 h-7 text-purple-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                No active raffles right now
              </h3>
              <p className="text-sm text-gray-400 mb-6">
                Check back soon or browse all raffles to see past draws.
              </p>
              <Link
                href="/portal/raffles"
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-xl transition-colors"
              >
                Browse all raffles
              </Link>
            </motion.div>
          ) : (
            /* Raffle cards grid */
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {raffles.map((raffle) => (
                <motion.div key={raffle.id} variants={fadeUp}>
                  <LandingRaffleCard raffle={raffle} />
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Mobile "View all" — below grid, visible on mobile only */}
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          variants={stagger}
          className="mt-8 lg:hidden"
        >
          <motion.div variants={fadeUp} className="flex justify-center">
            <Link
              href="/portal/raffles"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 w-full sm:w-auto text-sm font-semibold text-gray-300 hover:text-white border border-white/15 hover:border-white/30 rounded-xl transition-colors"
            >
              View all raffles
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
