'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Gamepad2, Coins, Ticket, ArrowRight } from 'lucide-react';
import { fadeUp, stagger } from '@/app/_landing-motion';

export function GameShowcase() {
  return (
    <section className="relative py-28 px-6 border-t border-white/8">
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.1]"
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(168,85,247,0.5) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />
      <div className="absolute -top-20 right-1/4 w-[400px] h-[400px] bg-fuchsia-700/15 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-6xl mx-auto relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            variants={stagger}
          >
            <motion.p
              variants={fadeUp}
              className="text-sm font-medium text-purple-400 mb-4 tracking-widest uppercase"
            >
              Play to earn
            </motion.p>
            <motion.h2
              variants={fadeUp}
              className="text-4xl sm:text-5xl font-bold tracking-tight mb-5"
            >
              Skill-based rewards.
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-fuchsia-400 to-purple-500">
                On-chain.
              </span>
            </motion.h2>
            <motion.p variants={fadeUp} className="text-gray-400 text-lg leading-relaxed mb-8">
              Play arcade-style mini-games to earn XP. Convert XP into Shellies Points on-chain. Spend points on premium raffles. Loop.
            </motion.p>

            <motion.ul variants={fadeUp} className="space-y-4 mb-10">
              {[
                {
                  icon: <Gamepad2 className="w-5 h-5" />,
                  title: 'Play & earn XP',
                  desc: 'Beat levels, hit high scores, accumulate experience points.',
                },
                {
                  icon: <Coins className="w-5 h-5" />,
                  title: 'Convert to points',
                  desc: 'Bridge XP to on-chain Shellies Points. Verified via contract.',
                },
                {
                  icon: <Ticket className="w-5 h-5" />,
                  title: 'Enter raffles',
                  desc: 'Spend points for tickets. Win NFTs, tokens, exclusive perks.',
                },
              ].map((it) => (
                <li key={it.title} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/15 text-purple-300 flex items-center justify-center shrink-0">
                    {it.icon}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white mb-1">{it.title}</div>
                    <div className="text-sm text-gray-400 leading-relaxed">{it.desc}</div>
                  </div>
                </li>
              ))}
            </motion.ul>

            <motion.div variants={fadeUp}>
              <Link
                href="/portal/game"
                className="inline-flex items-center gap-2 px-7 py-3.5 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl transition-colors text-sm"
              >
                Try the game
                <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="relative"
          >
            <div className="absolute inset-0 -m-8 bg-gradient-to-br from-purple-600/25 to-fuchsia-500/15 rounded-full blur-3xl" />
            <div className="relative rounded-3xl border border-white/15 bg-[#0f0720]/80 overflow-hidden backdrop-blur-sm shadow-[0_30px_80px_-20px_rgba(168,85,247,0.4)]">
              <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/8 bg-black/30">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/70" />
                <span className="w-2.5 h-2.5 rounded-full bg-green-400/70" />
                <span className="ml-3 text-[11px] text-gray-500 font-mono">portal/game</span>
              </div>
              <div
                className="relative aspect-[16/11] overflow-hidden"
                style={{
                  imageRendering: 'pixelated',
                  background:
                    'linear-gradient(180deg, #5c94fc 0%, #5c94fc 65%, #f9c089 65%, #d56a39 100%)',
                }}
              >
                <img
                  src="/mario-game-v2/images/bg.png"
                  alt="Game preview"
                  className="absolute inset-0 w-full h-full object-cover opacity-90"
                  style={{ imageRendering: 'pixelated' }}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
                <img
                  src="/mario-game-v2/images/coin.png"
                  alt=""
                  className="absolute top-6 right-8 w-8 h-8 animate-bounce"
                  style={{ imageRendering: 'pixelated', animationDuration: '1.4s' }}
                />
                <img
                  src="/mario-game-v2/images/coin.png"
                  alt=""
                  className="absolute top-12 right-20 w-6 h-6 animate-bounce"
                  style={{ imageRendering: 'pixelated', animationDuration: '1.8s' }}
                />
                <img
                  src="/mario-game-v2/images/flag-pole.png"
                  alt=""
                  className="absolute bottom-[35%] right-6 w-8 h-32 object-contain"
                  style={{ imageRendering: 'pixelated' }}
                />
                <img
                  src="/mario-game-v2/images/mario-head.png"
                  alt=""
                  className="absolute bottom-[35%] left-12 w-12 h-12 object-contain"
                  style={{ imageRendering: 'pixelated' }}
                />
                <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md border border-white/15 rounded-lg px-3 py-1.5 font-mono text-xs">
                  <div className="text-gray-400">XP</div>
                  <div className="text-yellow-300 font-bold tabular-nums">12,450</div>
                </div>
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between bg-black/70 backdrop-blur-md border border-white/15 rounded-lg px-3 py-2">
                  <div className="text-xs text-gray-300">
                    <span className="text-purple-300 font-semibold">+25 XP</span> per coin
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-[10px] font-semibold text-green-400 uppercase tracking-wider">Live</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
