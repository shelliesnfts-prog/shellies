'use client';

import { useAccount } from 'wagmi';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import CustomConnectButton from '@/components/CustomConnectButton';
import { LandingRafflesSection } from '@/components/landing/LandingRafflesSection';
import { HeroVisual } from '@/components/landing/HeroVisual';
import { LiveStatsBar } from '@/components/landing/LiveStatsBar';
import { TrustStrip } from '@/components/landing/TrustStrip';
import { RecentWinners } from '@/components/landing/RecentWinners';
import { GameShowcase } from '@/components/landing/GameShowcase';
import { TierComparison } from '@/components/landing/TierComparison';
import { TokenSection } from '@/components/landing/TokenSection';
import { FAQAccordion } from '@/components/landing/FAQAccordion';
import { LandingFooter, XIcon } from '@/components/landing/LandingFooter';
import { GrainOverlay } from '@/components/landing/GrainOverlay';
import { fadeUp, stagger } from '@/app/_landing-motion';

const ArrowRight = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
  </svg>
);
const ChevronDown = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

export default function LandingPage() {
  const { isConnected } = useAccount();
  const { data: session } = useSession();
  const router = useRouter();

  const handleEnterPortal = () => {
    if (isConnected && session) router.push('/portal');
  };

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#0a0118] text-white antialiased overflow-x-hidden">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              'radial-gradient(circle, rgba(168,85,247,0.5) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
        {/* Mesh gradient blobs */}
        <div className="absolute -top-32 left-1/4 w-[700px] h-[500px] bg-purple-700/25 rounded-full blur-[140px]" />
        <div className="absolute top-1/3 -right-20 w-[500px] h-[500px] bg-fuchsia-700/15 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-purple-900/20 rounded-full blur-[100px]" />
        <GrainOverlay opacity={0.08} />
      </div>

      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/8 bg-[#0a0118]/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <img
              src="/shellies_icon.jpg"
              alt="Shellies"
              className="w-8 h-8 rounded-lg object-cover"
            />
            <span className="text-sm font-bold tracking-widest text-purple-300 uppercase">
              Shellies
            </span>
          </div>

          <div className="hidden md:flex items-center gap-1">
            <button
              onClick={() => scrollTo('home')}
              className="px-4 py-2 text-sm capitalize text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
            >
              Home
            </button>
            <button
              onClick={() => scrollTo('about')}
              className="px-4 py-2 text-sm capitalize text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
            >
              About
            </button>
            <Link
              href="/portal/raffles"
              className="px-4 py-2 text-sm text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
            >
              Raffles
            </Link>
            <Link
              href="/portal/leaderboard"
              className="px-4 py-2 text-sm text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
            >
              Leaderboard
            </Link>
            <button
              onClick={() => scrollTo('faq')}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
            >
              FAQ
            </button>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="https://x.com/Shellies_NFTs"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Twitter"
              className="hidden sm:flex w-8 h-8 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 items-center justify-center transition-colors"
            >
              <XIcon />
            </a>
            {isConnected && session ? (
              <button
                onClick={handleEnterPortal}
                className="ml-1 px-5 py-2 text-sm font-semibold rounded-lg bg-purple-600 hover:bg-purple-500 transition-colors text-white"
              >
                Enter Portal
              </button>
            ) : (
              <CustomConnectButton size="sm" />
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section id="home" className="relative min-h-screen flex items-center pt-16">
        <div className="max-w-6xl mx-auto px-6 py-20 w-full relative z-10">
          <div className="grid lg:grid-cols-[1fr_420px] gap-16 xl:gap-24 items-center">
            <motion.div initial="hidden" animate="show" variants={stagger}>
              <motion.div variants={fadeUp} className="mb-7">
                <span className="inline-flex items-center gap-2 text-xs font-semibold text-green-400 bg-green-400/10 border border-green-400/20 px-4 py-1.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  Live on Ink Chain
                </span>
              </motion.div>

              <motion.h1
                variants={fadeUp}
                className="text-4xl sm:text-5xl lg:text-[3.75rem] xl:text-[4rem] font-bold tracking-tight leading-[1.06] mb-6"
              >
                Stake, earn, and{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-fuchsia-300 to-purple-500">
                  win big.
                </span>
              </motion.h1>

              <motion.p
                variants={fadeUp}
                className="text-gray-400 text-lg leading-relaxed mb-8"
              >
                The first raffle &amp; staking platform built exclusively for{' '}
                <span className="text-white font-medium">Shellies NFT</span> holders on Ink Chain.
                Hold, stake, earn daily points, and enter premium raffles.
              </motion.p>

              <motion.ul variants={fadeUp} className="space-y-3 mb-10">
                {[
                  'Earn up to 25+ points per day by holding & staking your NFTs',
                  'Claim a free daily bonus every 24 hours — no cost, just hold',
                  'Spend points to enter exclusive raffles with rare NFT prizes',
                  'Climb the community leaderboard for special bonuses & recognition',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-gray-400">
                    <span className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full bg-purple-500/20 border border-purple-500/40 flex items-center justify-center">
                      <svg
                        className="w-2.5 h-2.5 text-purple-400"
                        viewBox="0 0 12 12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
                      </svg>
                    </span>
                    <span className="leading-snug">{item}</span>
                  </li>
                ))}
              </motion.ul>

              <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-4 mb-10">
                {isConnected && session ? (
                  <>
                    <button
                      onClick={handleEnterPortal}
                      className="inline-flex items-center gap-2 px-7 py-3.5 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl transition-colors text-sm"
                    >
                      Enter Raffle Portal
                      <ArrowRight />
                    </button>
                    <button
                      onClick={() => scrollTo('about')}
                      className="inline-flex items-center gap-2 px-7 py-3.5 text-sm font-semibold text-gray-300 hover:text-white border border-white/15 hover:border-white/30 rounded-xl transition-colors"
                    >
                      How it works
                    </button>
                  </>
                ) : (
                  <>
                    <CustomConnectButton size="lg" />
                    <Link
                      href="/portal/raffles"
                      className="inline-flex items-center gap-2 px-7 py-3.5 text-sm font-semibold text-gray-300 hover:text-white border border-white/15 hover:border-white/30 rounded-xl transition-colors"
                    >
                      Browse Raffles
                      <ArrowRight />
                    </Link>
                  </>
                )}
              </motion.div>

              <motion.div variants={fadeUp} className="flex items-center gap-8 pt-2">
                <div>
                  <div className="text-2xl font-bold text-white">2,222</div>
                  <div className="text-xs text-gray-500 mt-0.5">Unique NFTs</div>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div>
                  <div className="text-2xl font-bold text-white">25+</div>
                  <div className="text-xs text-gray-500 mt-0.5">Points per day</div>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div>
                  <div className="text-2xl font-bold text-purple-400">Free</div>
                  <div className="text-xs text-gray-500 mt-0.5">Daily claim</div>
                </div>
              </motion.div>
            </motion.div>

            <div className="hidden lg:block relative px-8">
              <HeroVisual />
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 0.5 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-gray-600 cursor-pointer hover:text-gray-400 transition-colors"
            onClick={() => scrollTo('stats')}
          >
            <span className="text-xs tracking-widest uppercase">Scroll</span>
            <motion.div
              animate={{ y: [0, 5, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            >
              <ChevronDown />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── Live Stats ──────────────────────────────────────────────────────── */}
      <div id="stats">
        <LiveStatsBar />
      </div>

      {/* ── Trust Strip ─────────────────────────────────────────────────────── */}
      <TrustStrip />

      {/* ── Live Raffles ────────────────────────────────────────────────────── */}
      <LandingRafflesSection />

      {/* ── Recent Winners ──────────────────────────────────────────────────── */}
      <RecentWinners />

      {/* ── Game Showcase ───────────────────────────────────────────────────── */}
      <GameShowcase />

      {/* ── About / How it works ────────────────────────────────────────────── */}
      <section id="about" className="py-28 px-6 relative border-t border-white/8">
        <div className="max-w-6xl mx-auto relative z-10">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            variants={stagger}
            className="text-center mb-16"
          >
            <motion.p
              variants={fadeUp}
              className="text-sm font-medium text-purple-400 mb-4 tracking-widest uppercase"
            >
              Platform overview
            </motion.p>
            <motion.h2 variants={fadeUp} className="text-4xl sm:text-5xl font-bold tracking-tight mb-5">
              How it works
            </motion.h2>
            <motion.p variants={fadeUp} className="text-gray-400 max-w-lg mx-auto">
              Built for holders of the Shellies NFT collection. Participate, earn, and win.
            </motion.p>
          </motion.div>

          <TierComparison />

          {/* Use your points callout */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mt-12 rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-600/10 via-purple-500/5 to-transparent p-8 flex flex-col sm:flex-row items-start sm:items-center gap-6"
          >
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-300 shrink-0">
              <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
                <path d="M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM19 19H5V5H19V19Z" />
                <circle cx="7.5" cy="7.5" r="1.5" />
                <circle cx="16.5" cy="7.5" r="1.5" />
                <circle cx="7.5" cy="16.5" r="1.5" />
                <circle cx="16.5" cy="16.5" r="1.5" />
                <circle cx="12" cy="12" r="1.5" />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-white mb-1">Spend points on premium raffles</h4>
              <p className="text-sm text-gray-400 leading-relaxed">
                Accumulated points unlock entry into exclusive raffles — rare NFTs, token rewards, and
                community perks. The more you earn, the more chances you get.
              </p>
            </div>
            <div className="flex gap-2 flex-wrap shrink-0">
              {['NFT prizes', 'Token rewards', 'Exclusive access'].map((t) => (
                <span
                  key={t}
                  className="text-xs font-medium text-purple-300 bg-purple-500/10 px-3 py-1.5 rounded-full border border-purple-500/20"
                >
                  {t}
                </span>
              ))}
            </div>
          </motion.div>

          {/* Bottom CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mt-20"
          >
            {isConnected && session ? (
              <button
                onClick={handleEnterPortal}
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl transition-colors text-sm"
              >
                Start earning rewards
                <ArrowRight />
              </button>
            ) : (
              <div className="flex flex-wrap items-center justify-center gap-4">
                <CustomConnectButton size="xl" />
                <div className="flex items-center gap-3">
                  <Link
                    href="/portal/raffles"
                    className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-gray-300 hover:text-white border border-white/15 hover:border-white/30 rounded-xl transition-colors"
                  >
                    View Raffles
                  </Link>
                  <Link
                    href="/portal/leaderboard"
                    className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-gray-300 hover:text-white border border-white/15 hover:border-white/30 rounded-xl transition-colors"
                  >
                    Leaderboard
                  </Link>
                </div>
              </div>
            )}
            <p className="text-sm text-gray-500 mt-5">
              Join <span className="text-white font-medium">2,222 Shellies</span> holders earning daily
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── Token ───────────────────────────────────────────────────────────── */}
      <TokenSection />

      {/* ── FAQ ─────────────────────────────────────────────────────────────── */}
      <FAQAccordion />

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <LandingFooter />
    </div>
  );
}
