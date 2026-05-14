'use client';

import Link from 'next/link';
import { SP_TOKEN_ADDRESS, explorerToken } from '@/lib/explorer';

const XIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.256 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
  </svg>
);

const COLS = [
  {
    title: 'Product',
    links: [
      { label: 'Raffles', href: '/portal/raffles' },
      { label: 'Game', href: '/portal/game' },
      { label: 'Staking', href: '/portal/staking' },
      { label: 'Leaderboard', href: '/portal/leaderboard' },
    ],
  },
  {
    title: 'Community',
    links: [
      { label: 'Twitter / X', href: 'https://x.com/Shellies_NFTs', external: true },
      { label: 'Shellies Collection', href: '#', external: true },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'How it works', href: '#about' },
      { label: 'FAQ', href: '#faq' },
      { label: 'Ink Chain', href: 'https://inkonchain.com', external: true },
      ...(SP_TOKEN_ADDRESS
        ? [{ label: '$SP Token Contract', href: explorerToken(SP_TOKEN_ADDRESS), external: true }]
        : []),
    ],
  },
];

export function LandingFooter() {
  return (
    <footer className="relative border-t border-white/8 pt-16 pb-10 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-3 mb-5">
              <img src="/shellies_icon.jpg" alt="Shellies" className="w-9 h-9 rounded-lg object-cover" />
              <span className="text-base font-bold text-white tracking-wide">Shellies</span>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed mb-5 max-w-xs">
              Raffle, stake, and play-to-earn for the Shellies NFT community on Ink Chain.
            </p>
            <div className="flex items-center gap-2">
              <a
                href="#"
                aria-label="Twitter"
                className="w-9 h-9 rounded-lg border border-white/10 bg-white/[0.02] hover:border-purple-500/40 hover:bg-purple-500/10 hover:text-white text-gray-400 flex items-center justify-center transition-colors"
              >
                <XIcon />
              </a>

            </div>
          </div>

          {COLS.map((col) => (
            <div key={col.title}>
              <h4 className="text-xs font-semibold text-white uppercase tracking-widest mb-4">
                {col.title}
              </h4>
              <ul className="space-y-3">
                {col.links.map((l) => (
                  <li key={l.label}>
                    {'external' in l && l.external ? (
                      <a
                        href={l.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-gray-400 hover:text-white transition-colors"
                      >
                        {l.label}
                      </a>
                    ) : (
                      <Link
                        href={l.href}
                        className="text-sm text-gray-400 hover:text-white transition-colors"
                      >
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-8 border-t border-white/8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Live on Ink Chain
            </span>
            <span className="text-gray-700">•</span>
            <span>Chain ID 57073</span>
          </div>
          <p className="text-xs text-gray-600">© {new Date().getFullYear()} Shellies. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

export { XIcon };
