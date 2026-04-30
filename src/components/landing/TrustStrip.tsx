'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Link2, Copy, Check, ExternalLink } from 'lucide-react';
import {
  EXPLORER_BASE,
  SP_TOKEN_ADDRESS,
  explorerToken,
  shortAddress,
} from '@/lib/explorer';

export function TrustStrip() {
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
    <section className="relative py-10 px-6 border-b border-white/8">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="rounded-2xl border border-white/8 bg-[#0f0720]/60 backdrop-blur-sm p-5 sm:p-6 grid gap-5 md:grid-cols-3"
        >
          {/* Chain badge */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/15 text-purple-300 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-widest text-gray-500">Network</div>
              <div className="text-sm font-semibold text-white">Ink Chain · 57073</div>
            </div>
          </div>

          {/* SP token contract */}
          <div className="flex items-center gap-3 md:border-l md:border-white/8 md:pl-5">
            <div className="w-10 h-10 rounded-xl bg-purple-500/15 text-purple-300 flex items-center justify-center shrink-0">
              <Link2 className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs uppercase tracking-widest text-gray-500">$SP token</div>
              {SP_TOKEN_ADDRESS ? (
                <div className="flex items-center gap-2">
                  <a
                    href={explorerToken(SP_TOKEN_ADDRESS)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-sm text-purple-300 hover:text-purple-200 truncate"
                    title={SP_TOKEN_ADDRESS}
                  >
                    {shortAddress(SP_TOKEN_ADDRESS)}
                  </a>
                  <button
                    onClick={onCopy}
                    aria-label="Copy contract address"
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              ) : (
                <div className="text-sm text-gray-500">Coming soon</div>
              )}
            </div>
          </div>

          {/* Explorer link */}
          <div className="flex items-center gap-3 md:border-l md:border-white/8 md:pl-5">
            <div className="w-10 h-10 rounded-xl bg-purple-500/15 text-purple-300 flex items-center justify-center shrink-0">
              <ExternalLink className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs uppercase tracking-widest text-gray-500">Verified on-chain</div>
              <a
                href={EXPLORER_BASE}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold text-white hover:text-purple-200 transition-colors"
              >
                explorer.inkonchain.com
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
