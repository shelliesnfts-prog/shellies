'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy } from 'lucide-react';
import { fadeUp, stagger } from '@/app/_landing-motion';
import { explorerAddress } from '@/lib/explorer';

type Winner = {
  raffleId: number;
  title: string;
  imageUrl: string | null;
  winner: string;
  prizeType: 'NFT' | 'ERC20' | null;
  prizeAmount: string | null;
  prizeTokenId: string | null;
  endDate: string;
};

type RaffleApiItem = {
  id: number;
  title: string;
  image_url?: string;
  winner?: string | null;
  prize_token_type?: 'NFT' | 'ERC20';
  prize_amount?: string;
  prize_token_id?: string;
  end_date: string;
};

function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function timeAgo(iso: string) {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function prizeLabel(w: Winner): string {
  if (w.prizeType === 'NFT') return w.prizeTokenId ? `NFT #${w.prizeTokenId}` : 'NFT prize';
  if (w.prizeType === 'ERC20' && w.prizeAmount) return `${w.prizeAmount} tokens`;
  return 'Prize';
}

export function RecentWinners() {
  const [winners, setWinners] = useState<Winner[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/raffles?status=finished&page=1&limit=12')
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const items: RaffleApiItem[] = d.raffles ?? [];
        const mapped: Winner[] = items
          .filter(
            (r) => r.winner && r.winner !== '0x0000000000000000000000000000000000000000'
          )
          .map((r) => ({
            raffleId: r.id,
            title: r.title,
            imageUrl:
              r.image_url && !r.image_url.startsWith('blob:') ? r.image_url : null,
            winner: r.winner as string,
            prizeType: r.prize_token_type ?? null,
            prizeAmount: r.prize_amount ?? null,
            prizeTokenId: r.prize_token_id ?? null,
            endDate: r.end_date,
          }))
          .slice(0, 8);
        setWinners(mapped);
      })
      .catch(() => {
        if (!cancelled) setWinners([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (winners !== null && winners.length === 0) return null;

  const display = winners ?? Array.from({ length: 4 });

  return (
    <section className="relative py-20 px-6">
      <div className="max-w-6xl mx-auto">
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
            Recent winners
          </motion.p>
          <motion.h2
            variants={fadeUp}
            className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-3"
          >
            Real prizes. Real wallets.
          </motion.h2>
          <motion.p variants={fadeUp} className="text-gray-400 max-w-md">
            Latest community members who won. Drawn on-chain via verifiable randomness.
          </motion.p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-60px' }}
          variants={stagger}
          className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {display.slice(0, 8).map((w, i) => (
            <motion.div key={i} variants={fadeUp}>
              {!w ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 animate-pulse">
                  <div className="h-12 w-12 rounded-xl bg-white/10 mb-4" />
                  <div className="h-4 w-3/4 bg-white/10 rounded mb-2" />
                  <div className="h-3 w-1/2 bg-white/10 rounded" />
                </div>
              ) : (
                <WinnerCard winner={w as Winner} />
              )}
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function WinnerCard({ winner }: { winner: Winner }) {
  return (
    <div className="group relative rounded-2xl border border-white/10 bg-[#0f0720]/60 backdrop-blur-sm overflow-hidden hover:border-purple-500/40 transition-colors">
      <div className="relative aspect-[16/10] overflow-hidden">
        {winner.imageUrl ? (
          <img
            src={winner.imageUrl}
            alt={winner.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-900/30 to-fuchsia-900/20">
            <Trophy className="w-10 h-10 text-purple-400/60" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f0720] via-[#0f0720]/30 to-transparent" />
        <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/70 backdrop-blur-md border border-amber-400/20 rounded-full px-2.5 py-1">
          <Trophy className="w-3 h-3 text-amber-400" />
          <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider">Winner</span>
        </div>
      </div>
      <div className="p-4 space-y-2">
        <div className="text-sm font-semibold text-white truncate">{winner.title}</div>
        <div className="flex items-center justify-between text-xs">
          <a
            href={explorerAddress(winner.winner)}
            target="_blank"
            rel="noopener noreferrer"
            title={winner.winner}
            className="font-mono text-purple-300 hover:text-purple-200 bg-purple-500/10 border border-purple-500/20 hover:border-purple-400/40 rounded px-2 py-0.5 transition-colors"
          >
            {shortAddr(winner.winner)}
          </a>
          <span className="text-gray-500">{timeAgo(winner.endDate)}</span>
        </div>
        <div className="text-xs text-gray-400 pt-2 border-t border-white/5">
          Prize: <span className="text-white">{prizeLabel(winner)}</span>
        </div>
      </div>
    </div>
  );
}
