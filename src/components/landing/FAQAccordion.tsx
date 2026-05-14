'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { fadeUp, stagger } from '@/app/_landing-motion';
import {
  GAME_PAYMENT_ADDRESS,
  SP_TOKEN_ADDRESS,
  explorerAddress,
  explorerToken,
  shortAddress,
} from '@/lib/explorer';

type QA = { q: string; a: React.ReactNode };

const FAQ: QA[] = [
  {
    q: 'Do I need to own a Shellies NFT to participate?',
    a: 'No. Anyone can connect a wallet and earn 1 point per day on the free claim. NFT holders earn 5+ pts/day, and stakers earn up to 25+ pts/day. NFTs unlock the higher tiers.',
  },
  {
    q: 'How are raffle winners chosen?',
    a: 'Winner selection runs entirely on-chain via the Raffle smart contract on Ink. Once a raffle ends, the contract draws a winner using verifiable on-chain randomness. No off-chain rolls.',
  },
  {
    q: 'How does the daily claim work?',
    a: 'Connect wallet, click "Claim daily reward". Points are credited based on your tier (regular / holder / staker). 24-hour cooldown enforced server-side and on-chain.',
  },
  {
    q: 'What is XP and how does it convert to points?',
    a: (
      <>
        XP is earned in the in-app mini-game. To convert XP into on-chain Shellies Points ($SP), you
        submit a small ETH transaction to the{' '}
        {GAME_PAYMENT_ADDRESS ? (
          <a
            href={explorerAddress(GAME_PAYMENT_ADDRESS)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-300 hover:text-purple-200 underline underline-offset-2"
          >
            Game Payment contract ({shortAddress(GAME_PAYMENT_ADDRESS)})
          </a>
        ) : (
          'Game Payment contract'
        )}
        . The server verifies the tx then credits{' '}
        {SP_TOKEN_ADDRESS ? (
          <a
            href={explorerToken(SP_TOKEN_ADDRESS)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-300 hover:text-purple-200 underline underline-offset-2"
          >
            $SP
          </a>
        ) : (
          '$SP'
        )}
        .
      </>
    ),
  },
  {
    q: 'What can I win?',
    a: 'Premium NFTs (rare Shellies + partner collections), ERC-20 token rewards, and exclusive community perks. Prize pool refreshes weekly.',
  },
  {
    q: 'Which chain is this on? What about gas?',
    a: 'Ink Chain (chain ID 57073) — an L2 with extremely low fees. Most actions cost a fraction of a cent. You will need a tiny amount of ETH on Ink for gas.',
  },
];

export function FAQAccordion() {
  return (
    <section id="faq" className="relative py-28 px-6 border-t border-white/8">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
          variants={stagger}
          className="text-center mb-14"
        >
          <motion.p
            variants={fadeUp}
            className="text-sm font-medium text-purple-400 mb-4 tracking-widest uppercase"
          >
            Got questions?
          </motion.p>
          <motion.h2
            variants={fadeUp}
            className="text-4xl sm:text-5xl font-bold tracking-tight mb-4"
          >
            Frequently asked
          </motion.h2>
          <motion.p variants={fadeUp} className="text-gray-400 max-w-md mx-auto">
            Everything you need before you connect.
          </motion.p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-60px' }}
          variants={stagger}
          className="space-y-3"
        >
          {FAQ.map((item, i) => (
            <motion.div key={i} variants={fadeUp}>
              <Item qa={item} />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function Item({ qa }: { qa: QA }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden hover:border-white/15 transition-colors">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-6 py-5 flex items-center justify-between gap-6 text-left"
      >
        <span className="text-sm sm:text-base font-medium text-white">{qa.q}</span>
        <motion.span
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="w-7 h-7 rounded-full bg-purple-500/15 text-purple-300 flex items-center justify-center shrink-0"
        >
          <Plus className="w-4 h-4" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-5 text-sm text-gray-400 leading-relaxed">{qa.a}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
