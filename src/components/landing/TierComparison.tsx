'use client';

import { motion } from 'framer-motion';
import { Check, Sparkles, Crown, Wallet } from 'lucide-react';
import { fadeUp, stagger } from '@/app/_landing-motion';

type Tier = {
  name: string;
  rate: string;
  rateSub: string;
  icon: React.ReactNode;
  badge: string;
  features: string[];
  highlight?: boolean;
};

const TIERS: Tier[] = [
  {
    name: 'Regular',
    rate: '1',
    rateSub: 'pt / day',
    icon: <Wallet className="w-5 h-5" />,
    badge: 'Free',
    features: ['Daily free claim', 'Enter raffles', 'Earn from gameplay'],
  },
  {
    name: 'NFT Holder',
    rate: '5',
    rateSub: 'pts / day',
    icon: <Sparkles className="w-5 h-5" />,
    badge: 'Hold ≥1 NFT',
    features: ['Everything in Regular', '5× daily multiplier', 'Discounted XP→points conversion'],
    highlight: true,
  },
  {
    name: 'Staker',
    rate: '7–25',
    rateSub: 'pts / day',
    icon: <Crown className="w-5 h-5" />,
    badge: 'Stake ≥1 NFT',
    features: ['Everything in Holder', 'Lock bonuses up to 25 pts/day', 'Priority access on drops'],
  },
];

const LOCK_RATES = [
  { period: '1 day lock', mult: '7×', rate: '7 pts / day' },
  { period: '1 week lock', mult: '10×', rate: '10 pts / day' },
  { period: '1 month lock', mult: '20×', rate: '20 pts / day' },
];

export function TierComparison() {
  return (
    <div className="space-y-12">
      <motion.div
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-60px' }}
        variants={stagger}
      >
        <motion.div variants={fadeUp} className="text-center mb-10">
          <p className="text-sm font-medium text-purple-400 mb-3 tracking-widest uppercase">
            Earning tiers
          </p>
          <h3 className="text-3xl sm:text-4xl font-bold mb-3">Choose your path</h3>
          <p className="text-gray-400 text-sm max-w-md mx-auto">
            Three tiers, escalating rewards. Hold to multiply, stake to maximize.
          </p>
        </motion.div>

        <motion.div variants={fadeUp} className="grid md:grid-cols-3 gap-4">
          {TIERS.map((t) => (
            <div
              key={t.name}
              className={`relative rounded-2xl border p-7 ${
                t.highlight
                  ? 'border-purple-500/50 bg-gradient-to-br from-purple-600/15 via-purple-500/5 to-transparent shadow-[0_20px_60px_-20px_rgba(168,85,247,0.4)]'
                  : 'border-white/10 bg-white/[0.02]'
              }`}
            >
              {t.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-500 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
                  Most popular
                </div>
              )}
              <div className="flex items-center justify-between mb-6">
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                    t.highlight ? 'bg-purple-500/25 text-purple-200' : 'bg-purple-500/10 text-purple-300'
                  }`}
                >
                  {t.icon}
                </div>
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider bg-white/5 border border-white/10 rounded-full px-3 py-1">
                  {t.badge}
                </span>
              </div>
              <div className="text-sm font-medium text-gray-400 mb-2">{t.name}</div>
              <div className="flex items-baseline gap-2 mb-6">
                <span className={`text-5xl font-bold ${t.highlight ? 'text-purple-200' : 'text-white'} tabular-nums`}>
                  {t.rate}
                </span>
                <span className="text-sm text-gray-500">{t.rateSub}</span>
              </div>
              <ul className="space-y-2.5">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-gray-300">
                    <Check className={`w-4 h-4 mt-0.5 shrink-0 ${t.highlight ? 'text-purple-300' : 'text-purple-400'}`} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </motion.div>
      </motion.div>

      <motion.div
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-60px' }}
        variants={stagger}
        className="rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden"
      >
        <motion.div variants={fadeUp} className="px-6 py-4 border-b border-white/8 flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-purple-400" />
          <h4 className="text-sm font-semibold text-white">Staking lock period bonuses</h4>
        </motion.div>
        <div className="divide-y divide-white/5">
          {LOCK_RATES.map((r) => (
            <motion.div
              key={r.period}
              variants={fadeUp}
              className="flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors"
            >
              <span className="text-sm text-gray-400">{r.period}</span>
              <div className="flex items-center gap-4">
                <span className="text-xs text-gray-600 tabular-nums">{r.mult} base rate</span>
                <span className="text-sm font-semibold text-purple-300 w-24 text-right tabular-nums">{r.rate}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
