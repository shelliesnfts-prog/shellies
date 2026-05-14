'use client';

import { useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform, useMotionTemplate } from 'framer-motion';

export function HeroVisual() {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);

  const sx = useSpring(mx, { stiffness: 120, damping: 18, mass: 0.4 });
  const sy = useSpring(my, { stiffness: 120, damping: 18, mass: 0.4 });

  const rotateY = useTransform(sx, [-0.5, 0.5], [-12, 12]);
  const rotateX = useTransform(sy, [-0.5, 0.5], [10, -10]);
  const glowX = useTransform(sx, [-0.5, 0.5], ['25%', '75%']);
  const glowY = useTransform(sy, [-0.5, 0.5], ['25%', '75%']);
  const parallaxX = useTransform(sx, [-0.5, 0.5], [-12, 12]);
  const parallaxY = useTransform(sy, [-0.5, 0.5], [-12, 12]);
  const chipLeftX = useTransform(sx, [-0.5, 0.5], [-18, 18]);
  const chipLeftY = useTransform(sy, [-0.5, 0.5], [-12, 12]);
  const chipRightX = useTransform(sx, [-0.5, 0.5], [18, -18]);
  const chipRightY = useTransform(sy, [-0.5, 0.5], [12, -12]);
  const glowBg = useMotionTemplate`radial-gradient(420px circle at ${glowX} ${glowY}, rgba(255,255,255,0.18), transparent 50%)`;

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  }

  function handleLeave() {
    mx.set(0);
    my.set(0);
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.7, delay: 0.3, ease: 'easeOut' }}
      className="relative"
      style={{ perspective: 1200 }}
    >
      <div className="absolute inset-0 -m-12 bg-gradient-to-br from-purple-600/30 via-fuchsia-500/15 to-transparent rounded-full blur-3xl" />

      <motion.div
        ref={ref}
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
        style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
        className="relative rounded-3xl border border-white/15 bg-[#0f0720]/80 overflow-hidden backdrop-blur-sm shadow-[0_30px_80px_-20px_rgba(168,85,247,0.45)]"
      >
        <motion.div
          className="pointer-events-none absolute inset-0 z-20 opacity-60"
          style={{ background: glowBg }}
        />

        <div className="relative" style={{ transform: 'translateZ(40px)' }}>
          <motion.img
            src="/shellies_icon.jpg"
            alt="Shellies NFT"
            className="w-full object-cover aspect-square"
            style={{ x: parallaxX, y: parallaxY, scale: 1.06 }}
            draggable={false}
          />

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0f0720]/70 via-transparent to-transparent" />

          <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-black/60 backdrop-blur-md border border-white/10 rounded-full px-3 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs font-semibold text-white">Live Raffles</span>
          </div>

          <div className="absolute top-4 right-4 bg-purple-600/90 backdrop-blur-md rounded-full px-3 py-1.5">
            <span className="text-xs font-bold text-white">2,222 Edition</span>
          </div>
        </div>

        <div className="p-5 border-t border-white/10 bg-white/[0.02]" style={{ transform: 'translateZ(20px)' }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-xs text-gray-500 mb-0.5">Collection</div>
              <div className="text-sm font-semibold text-white">Shellies NFT</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500 mb-0.5">Chain</div>
              <div className="text-sm font-semibold text-purple-300">Ink Chain</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/8">
            {[
              { label: 'Daily pts', value: '25+' },
              { label: 'Staking', value: 'Active' },
              { label: 'Raffles', value: 'Open' },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <div className="text-sm font-bold text-white">{value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7, duration: 0.4 }}
        style={{ x: chipLeftX, y: chipLeftY }}
        className="absolute -left-6 top-1/3 bg-[#130d24]/90 border border-purple-500/30 rounded-2xl p-3 shadow-xl backdrop-blur-sm"
      >
        <div className="text-xs text-gray-500 mb-0.5">Daily claim</div>
        <div className="text-base font-bold text-white">Free</div>
        <div className="text-xs text-purple-400 mt-0.5">every 24h</div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.85, duration: 0.4 }}
        style={{ x: chipRightX, y: chipRightY }}
        className="absolute -right-6 bottom-1/3 bg-[#130d24]/90 border border-purple-500/30 rounded-2xl p-3 shadow-xl backdrop-blur-sm"
      >
        <div className="text-xs text-gray-500 mb-0.5">Max rewards</div>
        <div className="text-base font-bold text-purple-300">25+ pts</div>
        <div className="text-xs text-gray-500 mt-0.5">per day</div>
      </motion.div>
    </motion.div>
  );
}
