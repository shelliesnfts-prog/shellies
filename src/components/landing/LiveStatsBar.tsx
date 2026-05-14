'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Trophy, Ticket, Sparkles } from 'lucide-react';

type Stats = {
  holders: number;
  rafflesCompleted: number;
  rafflesTotal: number;
  ticketsSold: number;
};

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return n.toLocaleString();
}

export function LiveStatsBar() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/landing/stats')
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setStats(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const items = [
    { label: 'Holders', value: stats?.holders, icon: <Users className="w-4 h-4" /> },
    { label: 'Raffles run', value: stats?.rafflesCompleted, icon: <Trophy className="w-4 h-4" /> },
    { label: 'Total raffles', value: stats?.rafflesTotal, icon: <Sparkles className="w-4 h-4" /> },
    { label: 'Tickets sold', value: stats?.ticketsSold, icon: <Ticket className="w-4 h-4" /> },
  ];

  return (
    <section className="relative py-10 px-6 border-y border-white/8 bg-white/[0.015]">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {items.map((it, i) => (
            <motion.div
              key={it.label}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06, duration: 0.45 }}
              className="rounded-2xl border border-white/8 bg-[#0f0720]/60 backdrop-blur-sm p-5 flex items-center gap-4 hover:border-purple-500/30 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-500/15 text-purple-300 flex items-center justify-center shrink-0">
                {it.icon}
              </div>
              <div className="min-w-0">
                <div className="text-2xl font-bold text-white tabular-nums leading-none">
                  {it.value === undefined ? (
                    <span className="inline-block h-6 w-16 rounded bg-white/10 animate-pulse" />
                  ) : (
                    formatNumber(it.value)
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-1.5 uppercase tracking-wider">{it.label}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
