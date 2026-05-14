'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Coins, Copy, Check, ExternalLink, ArrowRight } from 'lucide-react';
import {
  SP_TOKEN_ADDRESS,
  explorerAddress,
  explorerToken,
  shortAddress,
} from '@/lib/explorer';
import { fadeUp, stagger } from '@/app/_landing-motion';

export function TokenSection() {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    if (!SP_TOKEN_ADDRESS) return;
    try {
      await navigator.clipboard.writeText(SP_TOKEN_ADDRESS);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <section id="token" className="relative py-24 px-6 border-t border-white/8">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
          variants={stagger}
          className="text-center mb-12"
        >
          <motion.p
            variants={fadeUp}
            className="text-sm font-medium text-purple-400 mb-4 tracking-widest uppercase"
          >
            On-chain currency
          </motion.p>
          <motion.h2
            variants={fadeUp}
            className="text-4xl sm:text-5xl font-bold tracking-tight mb-4"
          >
            $SP — Shellies Points
          </motion.h2>
          <motion.p variants={fadeUp} className="text-gray-400 max-w-xl mx-auto">
            ERC-20 token on Ink Chain. Earned by holding, staking, and playing. Spent on raffle entries.
          </motion.p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5 }}
          className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-600/10 via-purple-500/5 to-transparent p-7 sm:p-9"
        >
          <div className="flex flex-col lg:flex-row lg:items-center gap-7">
            <div className="flex items-center gap-4 shrink-0">
              <div className="w-14 h-14 rounded-2xl bg-purple-500/20 text-purple-200 flex items-center justify-center">
                <Coins className="w-7 h-7" />
              </div>
              <div>
                <div className="text-xs uppercase tracking-widest text-gray-500">Symbol</div>
                <div className="text-2xl font-bold text-white">$SP</div>
              </div>
            </div>

            <div className="flex-1 min-w-0 lg:border-l lg:border-white/10 lg:pl-7">
              <div className="text-xs uppercase tracking-widest text-gray-500 mb-2">Contract address</div>
              {SP_TOKEN_ADDRESS ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <a
                    href={explorerAddress(SP_TOKEN_ADDRESS)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-sm sm:text-base text-purple-200 hover:text-white break-all"
                  >
                    {SP_TOKEN_ADDRESS}
                  </a>
                  <button
                    onClick={onCopy}
                    aria-label="Copy contract address"
                    className="ml-1 p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              ) : (
                <div className="text-sm text-gray-400">Address publishes at launch.</div>
              )}
              <div className="text-xs text-gray-500 mt-2">
                Short: <span className="font-mono text-gray-400">{shortAddress(SP_TOKEN_ADDRESS)}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 shrink-0">
              {SP_TOKEN_ADDRESS && (
                <>
                  <a
                    href={explorerToken(SP_TOKEN_ADDRESS)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold rounded-xl transition-colors"
                  >
                    View token
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <a
                    href={explorerAddress(SP_TOKEN_ADDRESS)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-gray-200 hover:text-white border border-white/15 hover:border-white/30 rounded-xl transition-colors"
                  >
                    Contract
                    <ArrowRight className="w-4 h-4" />
                  </a>
                </>
              )}
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-4 mt-8 pt-7 border-t border-white/10">
            {[
              { k: 'Standard', v: 'ERC-20' },
              { k: 'Network', v: 'Ink · 57073' },
              { k: 'Use', v: 'Raffle entries' },
            ].map((it) => (
              <div key={it.k} className="rounded-xl bg-white/[0.02] border border-white/8 p-4">
                <div className="text-[11px] uppercase tracking-widest text-gray-500">{it.k}</div>
                <div className="text-sm font-semibold text-white mt-1">{it.v}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
