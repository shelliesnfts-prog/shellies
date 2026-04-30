'use client';

import { useAccount } from 'wagmi';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import CustomConnectButton from '@/components/CustomConnectButton';
import { LandingRafflesSection } from '@/components/landing/LandingRafflesSection';
import { fadeUp, stagger } from '@/app/_landing-motion';

/* ─── small reusables ───────────────────────────────────────────────────────── */
function FeatureCard({
  icon,
  title,
  description,
  tag,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  tag: string;
  href?: string;
}) {
  const inner = (
    <>
      <div className="w-10 h-10 rounded-xl bg-purple-500/15 flex items-center justify-center text-purple-400 mb-5 group-hover:bg-purple-500/25 transition-colors">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-gray-400 leading-relaxed mb-4">{description}</p>
      <span className="text-xs font-medium text-purple-400 bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/20">
        {tag}
      </span>
    </>
  );

  if (href) {
    return (
      <motion.div variants={fadeUp}>
        <Link
          href={href}
          className="group block rounded-2xl bg-white/[0.03] border border-white/10 p-7 hover:border-purple-500/40 hover:bg-white/[0.05] transition-all duration-300"
        >
          {inner}
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={fadeUp}
      className="group rounded-2xl bg-white/[0.03] border border-white/10 p-7 hover:border-purple-500/40 hover:bg-white/[0.05] transition-all duration-300"
    >
      {inner}
    </motion.div>
  );
}

/* ─── icons ─────────────────────────────────────────────────────────────────── */
const XIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.256 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/>
  </svg>
);
const DiscordIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
  </svg>
);
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

/* ─── hero NFT card ─────────────────────────────────────────────────────────── */
function HeroNFTCard() {
  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.7, delay: 0.3, ease: 'easeOut' }}
      className="relative"
    >
      {/* Glow behind the card */}
      <div className="absolute inset-0 -m-8 bg-purple-600/20 rounded-full blur-3xl" />

      {/* Main card */}
      <div className="relative rounded-3xl border border-white/15 bg-[#0f0720]/80 overflow-hidden backdrop-blur-sm">
        {/* Card image area */}
        <div className="relative">
          <img
            src="/shellies_icon.jpg"
            alt="Shellies NFT"
            className="w-full object-cover aspect-square"
          />
          {/* Overlay badge */}
          <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-black/60 backdrop-blur-md border border-white/10 rounded-full px-3 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs font-semibold text-white">Live Raffles</span>
          </div>
          {/* Edition badge */}
          <div className="absolute top-4 right-4 bg-purple-600/90 backdrop-blur-md rounded-full px-3 py-1.5">
            <span className="text-xs font-bold text-white">2,222 Edition</span>
          </div>
        </div>

        {/* Card footer */}
        <div className="p-5 border-t border-white/10 bg-white/[0.02]">
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
      </div>

      {/* Floating stat chips */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7, duration: 0.4 }}
        className="absolute -left-6 top-1/3 bg-[#130d24] border border-purple-500/30 rounded-2xl p-3 shadow-xl backdrop-blur-sm"
      >
        <div className="text-xs text-gray-500 mb-0.5">Daily claim</div>
        <div className="text-base font-bold text-white">Free</div>
        <div className="text-xs text-purple-400 mt-0.5">every 24h</div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.85, duration: 0.4 }}
        className="absolute -right-6 bottom-1/3 bg-[#130d24] border border-purple-500/30 rounded-2xl p-3 shadow-xl backdrop-blur-sm"
      >
        <div className="text-xs text-gray-500 mb-0.5">Max rewards</div>
        <div className="text-base font-bold text-purple-300">25+ pts</div>
        <div className="text-xs text-gray-500 mt-0.5">per day</div>
      </motion.div>
    </motion.div>
  );
}

/* ─── page ───────────────────────────────────────────────────────────────────── */
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
    <div className="min-h-screen bg-[#0a0118] text-white antialiased">

      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Dot grid texture */}
        <div
          className="absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(168,85,247,0.5) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
        {/* Ambient glow blobs */}
        <div className="absolute -top-32 left-1/3 w-[700px] h-[500px] bg-purple-700/25 rounded-full blur-[130px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-purple-900/20 rounded-full blur-[100px]" />
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
            {['home', 'about'].map((id) => (
              <button
                key={id}
                onClick={() => scrollTo(id)}
                className="px-4 py-2 text-sm capitalize text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
              >
                {id}
              </button>
            ))}
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
          </div>

          <div className="flex items-center gap-3">
            {isConnected && session ? (
              <button
                onClick={handleEnterPortal}
                className="px-5 py-2 text-sm font-semibold rounded-lg bg-purple-600 hover:bg-purple-500 transition-colors text-white"
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

            {/* Left: copy */}
            <motion.div
              initial="hidden"
              animate="show"
              variants={stagger}
            >
              {/* Chain badge */}
              <motion.div variants={fadeUp} className="mb-7">
                <span className="inline-flex items-center gap-2 text-xs font-semibold text-green-400 bg-green-400/10 border border-green-400/20 px-4 py-1.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  Live on Ink Chain
                </span>
              </motion.div>

              {/* Headline */}
              <motion.h1
                variants={fadeUp}
                className="text-4xl sm:text-5xl lg:text-[4rem] font-bold tracking-tight leading-[1.06] mb-6 whitespace-nowrap"
              >
                Stake, earn, and{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-purple-300 to-purple-500">
                  win big.
                </span>
              </motion.h1>

              {/* Sub */}
              <motion.p
                variants={fadeUp}
                className="text-gray-400 text-lg leading-relaxed mb-8"
              >
                The first raffle &amp; staking platform built exclusively for{' '}
                <span className="text-white font-medium">Shellies NFT</span> holders on Ink Chain.
                Hold, stake, earn daily points, and enter premium raffles.
              </motion.p>

              {/* Feature highlights */}
              <motion.ul variants={fadeUp} className="space-y-3 mb-10">
                {[
                  'Earn up to 25+ points per day by holding & staking your NFTs',
                  'Claim a free daily bonus every 24 hours — no cost, just hold',
                  'Spend points to enter exclusive raffles with rare NFT prizes',
                  'Climb the community leaderboard for special bonuses & recognition',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-gray-400">
                    <span className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full bg-purple-500/20 border border-purple-500/40 flex items-center justify-center">
                      <svg className="w-2.5 h-2.5 text-purple-400" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
                      </svg>
                    </span>
                    <span className="leading-snug">{item}</span>
                  </li>
                ))}
              </motion.ul>

              {/* CTAs */}
              <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-4 mb-10">
                {isConnected && session ? (
                  <button
                    onClick={handleEnterPortal}
                    className="inline-flex items-center gap-2 px-7 py-3.5 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl transition-colors text-sm"
                  >
                    Enter Raffle Portal
                    <ArrowRight />
                  </button>
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
                {isConnected && session && (
                  <button
                    onClick={() => scrollTo('about')}
                    className="inline-flex items-center gap-2 px-7 py-3.5 text-sm font-semibold text-gray-300 hover:text-white border border-white/15 hover:border-white/30 rounded-xl transition-colors"
                  >
                    How it works
                  </button>
                )}
              </motion.div>

              {/* Stats row */}
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

            {/* Right: NFT visual */}
            <div className="hidden lg:block relative px-8">
              <HeroNFTCard />
            </div>
          </div>

          {/* Scroll hint */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 0.5 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-gray-600 cursor-pointer hover:text-gray-400 transition-colors"
            onClick={() => scrollTo('about')}
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

      {/* ── Live Raffles ─────────────────────────────────────────────────────── */}
      <LandingRafflesSection />

      {/* ── About / How it works ─────────────────────────────────────────────── */}
      <section id="about" className="py-28 px-6 relative">
        <div className="max-w-6xl mx-auto relative z-10">

          {/* Section header */}
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            variants={stagger}
            className="text-center mb-16"
          >
            <motion.p variants={fadeUp} className="text-sm font-medium text-purple-400 mb-4 tracking-widest uppercase">
              Platform overview
            </motion.p>
            <motion.h2 variants={fadeUp} className="text-4xl sm:text-5xl font-bold tracking-tight mb-5">
              How it works
            </motion.h2>
            <motion.p variants={fadeUp} className="text-gray-400 max-w-lg mx-auto">
              Built for holders of the Shellies NFT collection. Participate, earn, and win.
            </motion.p>
          </motion.div>

          {/* Feature cards */}
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-60px' }}
            variants={stagger}
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-20"
          >
            <FeatureCard
              icon={
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                  <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L12 12L3 7V9L12 14L21 9ZM3 13V11L12 16L21 11V13L12 18L3 13ZM3 17V15L12 20L21 15V17L12 22L3 17Z"/>
                </svg>
              }
              title="Daily Rewards"
              description="Earn points automatically every day based on your Shellies holdings. The more you hold and stake, the higher your daily rewards."
              tag="Passive income"
            />
            <FeatureCard
              icon={
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                  <path d="M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM19 19H5V5H19V19Z"/>
                  <circle cx="7.5" cy="7.5" r="1.5"/><circle cx="16.5" cy="7.5" r="1.5"/>
                  <circle cx="7.5" cy="16.5" r="1.5"/><circle cx="16.5" cy="16.5" r="1.5"/>
                  <circle cx="12" cy="12" r="1.5"/>
                </svg>
              }
              title="Premium Raffles"
              description="Spend your earned points to enter exclusive raffles featuring rare NFTs, tokens, and other high-value prizes from the community."
              tag="High-value prizes"
              href="/portal/raffles"
            />
            <FeatureCard
              icon={
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                  <path d="M7 4V2C7 1.45 7.45 1 8 1H16C16.55 1 17 1.45 17 2V4H20C20.55 4 21 4.45 21 5S20.55 6 20 6H19V7C19 10.31 16.31 13 13 13H11C7.69 13 5 10.31 5 7V6H4C3.45 6 3 5.55 3 5S3.45 4 4 4H7ZM9 3V4H15V3H9ZM7 6V7C7 9.21 8.79 11 11 11H13C15.21 11 17 9.21 17 7V6H7Z"/>
                  <path d="M9 15H15L14 18H10L9 15Z"/><path d="M8 19H16V21H8V19Z"/>
                </svg>
              }
              title="Leaderboard"
              description="Compete with other Shellies holders for top spots on the community leaderboard and earn recognition and special bonuses."
              tag="Community status"
              href="/portal/leaderboard"
            />
          </motion.div>

          {/* Points system */}
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-60px' }}
            variants={stagger}
          >
            <motion.div variants={fadeUp} className="text-center mb-10">
              <p className="text-sm font-medium text-purple-400 mb-3 tracking-widest uppercase">
                Rewards system
              </p>
              <h3 className="text-3xl font-bold mb-3">Points earning rates</h3>
              <p className="text-gray-400 text-sm max-w-md mx-auto">
                Maximize your daily earnings by holding and staking your Shellies NFTs
              </p>
            </motion.div>

            <motion.div variants={fadeUp} className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
              {[
                { label: 'Regular users', value: '1 pt', sub: 'per day', accent: false },
                { label: 'NFT holders', value: '5 pts', sub: 'per day', accent: true },
                { label: 'Stakers (1 day)', value: '7 pts', sub: 'per day', accent: false },
                { label: 'Max potential', value: '25+', sub: 'pts / day', accent: true },
              ].map(({ label, value, sub, accent }) => (
                <div
                  key={label}
                  className={`rounded-xl p-6 border text-center ${
                    accent
                      ? 'border-purple-500/50 bg-purple-500/10'
                      : 'border-white/8 bg-white/[0.03]'
                  }`}
                >
                  <div className={`text-3xl font-bold mb-1 ${accent ? 'text-purple-300' : 'text-white'}`}>
                    {value}
                  </div>
                  <div className="text-xs font-medium text-white/60 mb-1">{label}</div>
                  <div className="text-xs text-gray-600">{sub}</div>
                </div>
              ))}
            </motion.div>

            {/* Staking breakdown table */}
            <motion.div
              variants={fadeUp}
              className="rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden mb-8"
            >
              <div className="px-6 py-4 border-b border-white/8 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-purple-400" />
                <h4 className="text-sm font-semibold text-white">Staking lock period bonuses</h4>
              </div>
              <div className="divide-y divide-white/5">
                {[
                  { period: '1 day lock', rate: '7 pts / day', mult: '7×' },
                  { period: '1 week lock', rate: '10 pts / day', mult: '10×' },
                  { period: '1 month lock', rate: '20 pts / day', mult: '20×' },
                ].map(({ period, rate, mult }) => (
                  <div key={period} className="flex items-center justify-between px-6 py-4">
                    <span className="text-sm text-gray-400">{period}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-gray-600 tabular-nums">{mult} base rate</span>
                      <span className="text-sm font-semibold text-purple-300 w-24 text-right">{rate}</span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Use your points callout */}
            <motion.div
              variants={fadeUp}
              className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-8 flex flex-col sm:flex-row items-start sm:items-center gap-6"
            >
              <div className="w-12 h-12 rounded-xl bg-purple-500/15 flex items-center justify-center text-purple-400 shrink-0">
                <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
                  <path d="M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM19 19H5V5H19V19Z"/>
                  <circle cx="7.5" cy="7.5" r="1.5"/><circle cx="16.5" cy="7.5" r="1.5"/>
                  <circle cx="7.5" cy="16.5" r="1.5"/><circle cx="16.5" cy="16.5" r="1.5"/>
                  <circle cx="12" cy="12" r="1.5"/>
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
                    className="text-xs font-medium text-purple-400 bg-purple-500/10 px-3 py-1.5 rounded-full border border-purple-500/15"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </motion.div>
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

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/8 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/shellies_icon.jpg"
              alt="Shellies"
              className="w-7 h-7 rounded-lg object-cover"
            />
            <span className="text-sm font-semibold text-gray-400">Shellies</span>
          </div>
          <p className="text-xs text-gray-600">
            The premier raffle platform for Ink Chain&apos;s Shellies NFT collection.
          </p>
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span>© 2025 Shellies</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
