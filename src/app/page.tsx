'use client';

import { useState, useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion, useScroll, useTransform } from 'framer-motion';
import CustomConnectButton from '@/components/CustomConnectButton';

// Professional Icons Component
const Icons = {
  Shell: () => (
    <svg viewBox="0 0 24 24" className="w-full h-full" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.88-11.71L12 14.17 8.12 8.29c-.39-.39-1.02-.39-1.41 0s-.39 1.02 0 1.41l4.59 4.59c.39.39 1.02.39 1.41 0l4.59-4.59c.39-.39.39-1.02 0-1.41s-1.02-.39-1.41 0z"/>
    </svg>
  ),
  Trophy: () => (
    <svg viewBox="0 0 24 24" className="w-full h-full" fill="currentColor">
      <path d="M7 4V2C7 1.45 7.45 1 8 1H16C16.55 1 17 1.45 17 2V4H20C20.55 4 21 4.45 21 5S20.55 6 20 6H19V7C19 10.31 16.31 13 13 13H11C7.69 13 5 10.31 5 7V6H4C3.45 6 3 5.55 3 5S3.45 4 4 4H7ZM9 3V4H15V3H9ZM7 6V7C7 9.21 8.79 11 11 11H13C15.21 11 17 9.21 17 7V6H7Z"/>
      <path d="M9 15H15L14 18H10L9 15Z"/>
      <path d="M8 19H16V21H8V19Z"/>
    </svg>
  ),
  Dice: () => (
    <svg viewBox="0 0 24 24" className="w-full h-full" fill="currentColor">
      <path d="M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM19 19H5V5H19V19Z"/>
      <circle cx="7.5" cy="7.5" r="1.5"/>
      <circle cx="16.5" cy="7.5" r="1.5"/>
      <circle cx="7.5" cy="16.5" r="1.5"/>
      <circle cx="16.5" cy="16.5" r="1.5"/>
      <circle cx="12" cy="12" r="1.5"/>
    </svg>
  ),
  Infinity: () => (
    <svg viewBox="0 0 24 24" className="w-full h-full" fill="currentColor">
      <path d="M18.6 6.62C17.16 6.62 15.8 7.18 14.83 8.15L12 10.98L9.17 8.15C8.2 7.18 6.84 6.62 5.4 6.62C2.42 6.62 0 9.04 0 12.02S2.42 17.42 5.4 17.42C6.84 17.42 8.2 16.86 9.17 15.89L12 13.06L14.83 15.89C15.8 16.86 17.16 17.42 18.6 17.42C21.58 17.42 24 15 24 12.02S21.58 6.62 18.6 6.62ZM5.4 15.42C3.52 15.42 2 13.9 2 12.02S3.52 8.62 5.4 8.62C6.29 8.62 7.12 8.97 7.76 9.61L10.59 12.44L7.76 15.27C7.12 15.91 6.29 16.26 5.4 16.26V15.42ZM18.6 15.42C17.71 15.42 16.88 15.07 16.24 14.43L13.41 11.6L16.24 8.77C16.88 8.13 17.71 7.78 18.6 7.78C20.48 7.78 22 9.3 22 12.18S20.48 15.58 18.6 15.58V15.42Z"/>
    </svg>
  ),
  Coins: () => (
    <svg viewBox="0 0 24 24" className="w-full h-full" fill="currentColor">
      <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L12 12L3 7V9L12 14L21 9ZM3 13V11L12 16L21 11V13L12 18L3 13ZM3 17V15L12 20L21 15V17L12 22L3 17Z"/>
    </svg>
  ),
  Chain: () => (
    <svg viewBox="0 0 24 24" className="w-full h-full" fill="currentColor">
      <path d="M3.9 12C3.9 10.29 5.29 8.9 7 8.9H9V7H7C4.24 7 2 9.24 2 12S4.24 17 7 17H9V15.1H7C5.29 15.1 3.9 13.71 3.9 12ZM8 13H16V11H8V13ZM17 7H15V8.9H17C18.71 8.9 20.1 10.29 20.1 12S18.71 15.1 17 15.1H15V17H17C19.76 17 22 14.76 22 12S19.76 7 17 7Z"/>
    </svg>
  ),
  Shield: () => (
    <svg viewBox="0 0 24 24" className="w-full h-full" fill="currentColor">
      <path d="M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1M12,7C13.4,7 14.8,8.6 14.8,10V11H16V18H8V11H9.2V10C9.2,8.6 10.6,7 12,7M12,8.2C11.2,8.2 10.4,8.7 10.4,10V11H13.6V10C13.6,8.7 12.8,8.2 12,8.2Z"/>
    </svg>
  )
};

// Simple counter component
function AnimatedCounter({ end, duration = 1500 }: { end: number; duration?: number }) {
  const [count, setCount] = useState<number | string>(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          let startTime: number | null = null;
          
          const animate = (currentTime: number) => {
            if (!startTime) startTime = currentTime;
            const progress = Math.min((currentTime - startTime) / duration, 1);
            
            if (end === Infinity) {
              setCount('∞');
            } else {
              setCount(Math.floor(progress * end));
            }
            
            if (progress < 1 && end !== Infinity) {
              requestAnimationFrame(animate);
            }
          };
          
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.5 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [end, duration, hasAnimated]);

  return (
    <div ref={ref} className="text-4xl font-bold text-gradient counter-animate">
      {end === Infinity ? '∞' : count}
    </div>
  );
}

export default function LandingPage() {
  const [activeSection, setActiveSection] = useState('home');
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const { isConnected } = useAccount();
  const { data: session } = useSession();
  const router = useRouter();
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 1], ['0%', '50%']);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    const element = document.getElementById(sectionId);
    element?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleEnterPortal = () => {
    if (isConnected && session) {
      router.push('/portal');
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0118] relative overflow-hidden">
      {/* Futuristic Background Effects */}
      <div className="fixed inset-0 z-0">
        {/* Animated Grid */}
        <div className="absolute inset-0 bg-grid-pattern opacity-20"></div>
        
        {/* Dynamic Gradient Orbs */}
        <motion.div 
          className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/30 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div 
          className="absolute bottom-0 right-1/4 w-96 h-96 bg-pink-600/30 rounded-full blur-3xl"
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div 
          className="absolute top-1/2 left-1/2 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
        
        {/* Mouse Follow Glow */}
        <div 
          className="absolute w-96 h-96 bg-purple-500/20 rounded-full blur-3xl pointer-events-none transition-all duration-300"
          style={{
            left: mousePosition.x - 192,
            top: mousePosition.y - 192,
          }}
        />
      </div>

      {/* Futuristic Navigation */}
      <nav className="fixed top-0 w-full bg-black/40 backdrop-blur-2xl border-b border-purple-500/30 z-50 shadow-2xl shadow-purple-900/20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex justify-between items-center py-5">
            <motion.div 
              className="flex items-center space-x-3"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center overflow-hidden relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity blur-xl"></div>
                <img
                  src="/shellies_icon.jpg"
                  alt="Shellies Logo"
                  className="w-full h-full object-cover rounded-2xl relative z-10 group-hover:scale-110 transition-transform"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-2xl shellies-brand tracking-wider" data-text="SHELLIES">SHELLIES</span>
                <span className="text-xs text-purple-300 font-semibold tracking-wide">RAFFLE & STAKING PLATFORM</span>
              </div>
            </motion.div>
            
            <div className="hidden md:flex items-center space-x-2">
              <button
                onClick={() => scrollToSection('home')}
                className={`text-sm font-bold px-5 py-2.5 rounded-xl transition-all duration-300 relative overflow-hidden group ${
                  activeSection === 'home'
                    ? 'text-white bg-gradient-to-r from-purple-600 to-pink-600 shadow-lg shadow-purple-500/50'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                {activeSection !== 'home' && (
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-pink-600/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                )}
                <span className="relative z-10">Home</span>
              </button>
              <button
                onClick={() => scrollToSection('about')}
                className={`text-sm font-bold px-5 py-2.5 rounded-xl transition-all duration-300 relative overflow-hidden group ${
                  activeSection === 'about'
                    ? 'text-white bg-gradient-to-r from-purple-600 to-pink-600 shadow-lg shadow-purple-500/50'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                {activeSection !== 'about' && (
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-pink-600/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                )}
                <span className="relative z-10">About</span>
              </button>
            </div>
            
            {isConnected && session ? (
              <motion.button
                onClick={handleEnterPortal}
                className="relative px-8 py-3 text-sm font-bold text-white rounded-xl overflow-hidden group"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 bg-[length:200%_100%] animate-gradient"></div>
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 blur-xl"></div>
                <span className="relative z-10 tracking-wide">ENTER PORTAL</span>
              </motion.button>
            ) : (
              <CustomConnectButton size="sm" className="text-sm px-6 py-3" />
            )}
          </div>
        </div>
      </nav>

      {/* Futuristic Hero Section */}
      <section id="home" className="pt-32 pb-32 min-h-screen flex items-center relative overflow-hidden">
        {/* Geometric Shapes */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-32 h-32 border-2 border-purple-500 rotate-45 animate-spin-slow"></div>
          <div className="absolute bottom-20 right-10 w-40 h-40 border-2 border-pink-500 rounded-full animate-pulse-slow"></div>
          <div className="absolute top-1/2 left-1/3 w-24 h-24 border-2 border-blue-500 animate-float"></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center">
            {/* Futuristic Main Heading */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="mb-8"
            >
              {/* Glitch Effect Badge */}
              <motion.div 
                className="inline-flex items-center gap-2 px-6 py-3 mb-8 rounded-full bg-gradient-to-r from-purple-900/50 to-pink-900/50 border border-purple-500/50 backdrop-blur-xl"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
              >
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                <span className="text-sm font-bold text-purple-200 tracking-wider">LIVE ON INK CHAIN</span>
              </motion.div>

              <h1 className="text-6xl sm:text-7xl lg:text-8xl mb-6 relative">
                <span className="shellies-brand block relative" data-text="SHELLIES">
                  SHELLIES
                  <div className="absolute inset-0 blur-2xl bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 opacity-50 animate-pulse-slow"></div>
                </span>
              </h1>
              <motion.h2 
                className="text-3xl sm:text-4xl lg:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-200 via-pink-200 to-purple-200"
                animate={{ backgroundPosition: ['0%', '100%', '0%'] }}
                transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
              >
                First Raffle & Staking Platform on Ink Chain
              </motion.h2>
            </motion.div>

            {/* Futuristic Description */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="mb-14"
            >
              <p className="text-xl sm:text-2xl text-gray-200 max-w-4xl mx-auto leading-relaxed mb-6 font-medium">
                Exclusive raffle ecosystem for holders of the Shellies NFT collection on{' '}
                <span className="relative inline-block">
                  <span className="text-gradient font-bold">Ink Chain</span>
                  <span className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-pink-500 blur-sm"></span>
                </span>
              </p>
              <p className="text-lg sm:text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
                Stake your Shellies, earn daily rewards, and participate in premium raffles with incredible prizes
              </p>
            </motion.div>

            {/* Futuristic CTA Buttons */}
            <motion.div 
              className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-20"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
            >
              {isConnected && session ? (
                <motion.button
                  onClick={handleEnterPortal}
                  className="relative group px-10 py-5 text-lg font-black rounded-2xl overflow-hidden"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 bg-[length:200%_100%] animate-gradient"></div>
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 blur-2xl"></div>
                  </div>
                  <span className="relative z-10 flex items-center gap-3 tracking-wide">
                    <span>ENTER RAFFLE PORTAL</span>
                    <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </span>
                </motion.button>
              ) : (
                <CustomConnectButton size="sm" className="text-lg px-10 py-5" />
              )}
              <motion.button
                onClick={() => scrollToSection('about')}
                className="relative group px-10 py-5 text-lg font-black rounded-2xl overflow-hidden border-2 border-purple-500/50 text-white"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 to-pink-600/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <span className="relative z-10 tracking-wide">LEARN MORE</span>
              </motion.button>
            </motion.div>

            {/* Futuristic Stats */}
            <motion.div 
              className="grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-6xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.8 }}
            >
              <motion.div 
                className="relative group"
                whileHover={{ y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-3xl blur-xl group-hover:blur-2xl transition-all"></div>
                <div className="relative text-center bg-black/40 backdrop-blur-2xl border border-purple-500/30 rounded-3xl p-10 overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl"></div>
                  <div className="relative z-10">
                    <div className="w-20 h-20 rounded-3xl mx-auto mb-6 flex items-center justify-center overflow-hidden relative group-hover:scale-110 transition-transform">
                      <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500 opacity-50 group-hover:opacity-100 transition-opacity blur-xl"></div>
                      <img
                        src="/shellies_icon.jpg"
                        alt="Shellies Logo"
                        className="w-full h-full object-cover rounded-3xl relative z-10"
                      />
                    </div>
                    <AnimatedCounter end={2222} />
                    <div className="text-gray-200 font-bold mt-3 text-lg">Unique NFTs</div>
                    <div className="text-sm text-purple-300 font-semibold mt-2 tracking-wide">IN COLLECTION</div>
                  </div>
                </div>
              </motion.div>
              
              <motion.div 
                className="relative group"
                whileHover={{ y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-pink-600/20 to-purple-600/20 rounded-3xl blur-xl group-hover:blur-2xl transition-all"></div>
                <div className="relative text-center bg-black/40 backdrop-blur-2xl border border-pink-500/30 rounded-3xl p-10 overflow-hidden">
                  <div className="absolute top-0 left-0 w-32 h-32 bg-pink-500/10 rounded-full blur-3xl"></div>
                  <div className="relative z-10">
                    <div className="w-20 h-20 rounded-3xl mx-auto mb-6 flex items-center justify-center bg-gradient-to-br from-pink-600 to-purple-600 group-hover:scale-110 transition-transform shadow-lg shadow-pink-500/50">
                      <div className="w-10 h-10 text-white">
                        <svg viewBox="0 0 24 24" className="w-full h-full" fill="currentColor">
                          <path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z"/>
                          <path d="M19 15L19.91 17.53L23 18L19.91 18.47L19 21L18.09 18.47L15 18L18.09 17.53L19 15Z"/>
                          <path d="M5 15L5.91 17.53L9 18L5.91 18.47L5 21L4.09 18.47L1 18L4.09 17.53L5 15Z"/>
                        </svg>
                      </div>
                    </div>
                    <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400 mb-2">FREE</div>
                    <div className="text-gray-200 font-bold mt-3 text-lg">Entry</div>
                    <div className="text-sm text-pink-300 font-semibold mt-2 tracking-wide">DAILY BONUS</div>
                  </div>
                </div>
              </motion.div>
              
              <motion.div 
                className="relative group"
                whileHover={{ y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-purple-600/20 rounded-3xl blur-xl group-hover:blur-2xl transition-all"></div>
                <div className="relative text-center bg-black/40 backdrop-blur-2xl border border-blue-500/30 rounded-3xl p-10 overflow-hidden">
                  <div className="absolute bottom-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl"></div>
                  <div className="relative z-10">
                    <div className="w-20 h-20 rounded-3xl mx-auto mb-6 flex items-center justify-center bg-gradient-to-br from-blue-600 to-purple-600 group-hover:scale-110 transition-transform shadow-lg shadow-blue-500/50">
                      <div className="w-10 h-10 text-white">
                        <Icons.Infinity />
                      </div>
                    </div>
                    <AnimatedCounter end={Infinity} />
                    <div className="text-gray-200 font-bold mt-3 text-lg">Prize Pool</div>
                    <div className="text-sm text-blue-300 font-semibold mt-2 tracking-wide">OPPORTUNITIES</div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
            
            {/* Futuristic Trust Indicators */}
            <motion.div 
              className="flex flex-wrap justify-center items-center gap-8 mt-16"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 1 }}
            >
              <motion.div 
                className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-black/30 backdrop-blur-xl border border-purple-500/30"
                whileHover={{ scale: 1.05, borderColor: 'rgba(168, 85, 247, 0.6)' }}
              >
                <div className="w-6 h-6 text-purple-400">
                  <Icons.Chain />
                </div>
                <span className="text-sm font-bold text-gray-200 tracking-wide">INK CHAIN NATIVE</span>
              </motion.div>
              <motion.div 
                className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-black/30 backdrop-blur-xl border border-pink-500/30"
                whileHover={{ scale: 1.05, borderColor: 'rgba(236, 72, 153, 0.6)' }}
              >
                <div className="w-6 h-6 text-pink-400">
                  <Icons.Shield />
                </div>
                <span className="text-sm font-bold text-gray-200 tracking-wide">SECURE & VERIFIED</span>
              </motion.div>
              <motion.div 
                className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-black/30 backdrop-blur-xl border border-blue-500/30"
                whileHover={{ scale: 1.05, borderColor: 'rgba(59, 130, 246, 0.6)' }}
              >
                <div className="w-6 h-6 text-blue-400">
                  <Icons.Coins />
                </div>
                <span className="text-sm font-bold text-gray-200 tracking-wide">PREMIUM REWARDS</span>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Futuristic About Section */}
      <section id="about" className="py-32 bg-[#0a0118] relative overflow-hidden">
        {/* Futuristic Background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
          <div className="absolute top-1/4 left-0 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl"></div>
          <div className="absolute bottom-1/4 right-0 w-96 h-96 bg-pink-600/20 rounded-full blur-3xl"></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center mb-20">
            <motion.div 
              className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-purple-900/40 to-pink-900/40 border border-purple-400/40 rounded-full mb-10 backdrop-blur-xl"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></div>
              <span className="text-purple-200 text-sm font-bold tracking-wider">PLATFORM OVERVIEW</span>
            </motion.div>
            
            <motion.h2 
              className="text-5xl sm:text-6xl lg:text-7xl font-black text-white mb-8 relative"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <span className="relative">
                How It Works
                <div className="absolute inset-0 blur-3xl bg-gradient-to-r from-purple-600 to-pink-600 opacity-30"></div>
              </span>
            </motion.h2>
            
            <motion.p 
              className="text-xl sm:text-2xl text-gray-200 mb-6 max-w-3xl mx-auto font-medium"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              Built exclusively for holders of the SHELLIES NFT collection on{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 font-bold">Ink Chain</span>
            </motion.p>
            
            <motion.p 
              className="text-lg sm:text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              Turn your Shellies NFTs into passive income through our innovative staking and raffle system
            </motion.p>
          </div>
          
          {/* Futuristic Feature Cards */}
          <div className="grid lg:grid-cols-3 gap-10 mb-20">
            <motion.div 
              className="relative group"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              whileHover={{ y: -10 }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-purple-600/30 to-pink-600/30 rounded-3xl blur-2xl group-hover:blur-3xl transition-all"></div>
              <div className="relative bg-black/50 backdrop-blur-2xl border border-purple-500/40 rounded-3xl p-10 text-center overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl"></div>
                <div className="relative z-10">
                  <div className="w-24 h-24 rounded-3xl mx-auto mb-8 flex items-center justify-center bg-gradient-to-br from-purple-600 to-pink-600 group-hover:scale-110 transition-transform shadow-2xl shadow-purple-500/50">
                    <div className="w-12 h-12 text-white">
                      <Icons.Coins />
                    </div>
                  </div>
                  <h3 className="text-2xl font-black text-white mb-5">Daily Rewards</h3>
                  <p className="text-gray-200 leading-relaxed mb-8 text-base">
                    Earn points automatically based on your Shellies holdings. More NFTs means higher daily rewards.
                  </p>
                  <div className="inline-flex items-center gap-2 text-sm text-purple-300 font-bold bg-purple-900/50 px-5 py-2 rounded-full border border-purple-500/30">
                    <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></div>
                    PASSIVE INCOME
                  </div>
                </div>
              </div>
            </motion.div>
            
            <motion.div 
              className="relative group"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              whileHover={{ y: -10 }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-pink-600/30 to-purple-600/30 rounded-3xl blur-2xl group-hover:blur-3xl transition-all"></div>
              <div className="relative bg-black/50 backdrop-blur-2xl border border-pink-500/40 rounded-3xl p-10 text-center overflow-hidden">
                <div className="absolute top-0 left-0 w-40 h-40 bg-pink-500/10 rounded-full blur-3xl"></div>
                <div className="relative z-10">
                  <div className="w-24 h-24 rounded-3xl mx-auto mb-8 flex items-center justify-center bg-gradient-to-br from-pink-600 to-purple-600 group-hover:scale-110 transition-transform shadow-2xl shadow-pink-500/50">
                    <div className="w-12 h-12 text-white">
                      <Icons.Dice />
                    </div>
                  </div>
                  <h3 className="text-2xl font-black text-white mb-5">Premium Raffles</h3>
                  <p className="text-gray-200 leading-relaxed mb-8 text-base">
                    Enter exclusive raffles using your earned points. Win rare NFTs, tokens, and premium prizes.
                  </p>
                  <div className="inline-flex items-center gap-2 text-sm text-pink-300 font-bold bg-pink-900/50 px-5 py-2 rounded-full border border-pink-500/30">
                    <div className="w-2 h-2 rounded-full bg-pink-400 animate-pulse"></div>
                    HIGH-VALUE PRIZES
                  </div>
                </div>
              </div>
            </motion.div>
            
            <motion.div 
              className="relative group"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3 }}
              whileHover={{ y: -10 }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600/30 to-purple-600/30 rounded-3xl blur-2xl group-hover:blur-3xl transition-all"></div>
              <div className="relative bg-black/50 backdrop-blur-2xl border border-blue-500/40 rounded-3xl p-10 text-center overflow-hidden">
                <div className="absolute bottom-0 right-0 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl"></div>
                <div className="relative z-10">
                  <div className="w-24 h-24 rounded-3xl mx-auto mb-8 flex items-center justify-center bg-gradient-to-br from-blue-600 to-purple-600 group-hover:scale-110 transition-transform shadow-2xl shadow-blue-500/50">
                    <div className="w-12 h-12 text-white">
                      <Icons.Trophy />
                    </div>
                  </div>
                  <h3 className="text-2xl font-black text-white mb-5">Leaderboard</h3>
                  <p className="text-gray-200 leading-relaxed mb-8 text-base">
                    Compete with other holders on the community leaderboard for special bonuses and recognition.
                  </p>
                  <div className="inline-flex items-center gap-2 text-sm text-blue-300 font-bold bg-blue-900/50 px-5 py-2 rounded-full border border-blue-500/30">
                    <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></div>
                    COMMUNITY STATUS
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Points Mechanism Section */}
          <motion.div
            className="mb-20"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <div className="text-center mb-16">
              <motion.div 
                className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-purple-900/40 to-pink-900/40 border border-purple-400/40 rounded-full mb-8 backdrop-blur-xl"
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
              >
                <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></div>
                <span className="text-purple-200 text-sm font-bold tracking-wider">REWARDS SYSTEM</span>
              </motion.div>
              <h3 className="text-4xl sm:text-5xl font-black text-white mb-6 relative">
                <span className="relative">
                  Points Earning System
                  <div className="absolute inset-0 blur-3xl bg-gradient-to-r from-purple-600 to-pink-600 opacity-20"></div>
                </span>
              </h3>
              <p className="text-lg sm:text-xl text-gray-200 max-w-2xl mx-auto">
                Maximize your daily rewards through different participation levels
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {/* Regular Users */}
              <motion.div
                className="relative group"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.1 }}
                whileHover={{ y: -8 }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-gray-600/20 to-purple-600/20 rounded-3xl blur-xl group-hover:blur-2xl transition-all"></div>
                <div className="relative bg-black/40 backdrop-blur-2xl border border-gray-500/30 rounded-3xl p-8 text-center overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gray-500/10 rounded-full blur-3xl"></div>
                  <div className="relative z-10">
                    <div className="w-20 h-20 rounded-3xl mx-auto mb-6 flex items-center justify-center bg-gradient-to-br from-gray-600 to-purple-600 group-hover:scale-110 transition-transform shadow-lg shadow-gray-500/30">
                      <div className="w-10 h-10 text-white">
                        <svg viewBox="0 0 24 24" className="w-full h-full" fill="currentColor">
                          <path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z"/>
                        </svg>
                      </div>
                    </div>
                    <h3 className="text-xl font-black text-white mb-4">Regular Users</h3>
                    <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-gray-300 to-purple-300 counter-animate mb-3">1</div>
                    <div className="text-gray-200 font-bold mb-4">point per day</div>
                    <div className="inline-flex items-center gap-2 text-xs text-gray-300 font-bold bg-gray-900/50 px-4 py-2 rounded-full border border-gray-500/30">
                      BASE RATE
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* NFT Holders */}
              <motion.div
                className="relative group"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2 }}
                whileHover={{ y: -8 }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-purple-600/30 to-pink-600/30 rounded-3xl blur-xl group-hover:blur-2xl transition-all"></div>
                <div className="relative bg-black/40 backdrop-blur-2xl border border-purple-500/40 rounded-3xl p-8 text-center overflow-hidden">
                  <div className="absolute top-0 left-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl"></div>
                  <div className="relative z-10">
                    <div className="w-20 h-20 rounded-3xl mx-auto mb-6 flex items-center justify-center overflow-hidden group-hover:scale-110 transition-transform relative">
                      <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500 opacity-50 group-hover:opacity-100 transition-opacity blur-xl"></div>
                      <img
                        src="/shellies_icon.jpg"
                        alt="Shellies Logo"
                        className="w-full h-full object-cover rounded-3xl relative z-10"
                      />
                    </div>
                    <h3 className="text-xl font-black text-white mb-4">NFT Holders</h3>
                    <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 counter-animate mb-3">5</div>
                    <div className="text-gray-200 font-bold mb-4">points per day</div>
                    <div className="inline-flex items-center gap-2 text-xs text-purple-300 font-bold bg-purple-900/50 px-4 py-2 rounded-full border border-purple-500/30">
                      HOLD SHELLIES
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Staking Rewards */}
              <motion.div
                className="relative group"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.3 }}
                whileHover={{ y: -8 }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-blue-600/30 to-purple-600/30 rounded-3xl blur-xl group-hover:blur-2xl transition-all"></div>
                <div className="relative bg-black/40 backdrop-blur-2xl border border-blue-500/40 rounded-3xl p-8 text-center overflow-hidden">
                  <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl"></div>
                  <div className="relative z-10">
                    <div className="w-20 h-20 rounded-3xl mx-auto mb-6 flex items-center justify-center bg-gradient-to-br from-blue-600 to-purple-600 group-hover:scale-110 transition-transform shadow-lg shadow-blue-500/30">
                      <div className="w-10 h-10 text-white">
                        <Icons.Shield />
                      </div>
                    </div>
                    <h3 className="text-xl font-black text-white mb-6">Staking Rewards</h3>
                    <div className="text-gray-200 leading-relaxed mb-6 space-y-3">
                      <div className="flex justify-between items-center px-4 py-2 bg-blue-900/30 rounded-xl border border-blue-500/20">
                        <span className="text-sm font-bold">1 Day:</span>
                        <span className="font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">7 pts/day</span>
                      </div>
                      <div className="flex justify-between items-center px-4 py-2 bg-blue-900/30 rounded-xl border border-blue-500/20">
                        <span className="text-sm font-bold">1 Week:</span>
                        <span className="font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">10 pts/day</span>
                      </div>
                      <div className="flex justify-between items-center px-4 py-2 bg-blue-900/30 rounded-xl border border-blue-500/20">
                        <span className="text-sm font-bold">1 Month:</span>
                        <span className="font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">20 pts/day</span>
                      </div>
                    </div>
                    <div className="inline-flex items-center gap-2 text-xs text-blue-300 font-bold bg-blue-900/50 px-4 py-2 rounded-full border border-blue-500/30">
                      LOCK PERIOD BONUS
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Maximum Potential */}
              <motion.div
                className="relative group"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.4 }}
                whileHover={{ y: -8 }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-600/30 to-orange-600/30 rounded-3xl blur-xl group-hover:blur-2xl transition-all"></div>
                <div className="relative bg-black/40 backdrop-blur-2xl border border-yellow-500/40 rounded-3xl p-8 text-center overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-full blur-3xl"></div>
                  <div className="relative z-10">
                    <div className="w-20 h-20 rounded-3xl mx-auto mb-6 flex items-center justify-center bg-gradient-to-br from-yellow-600 to-orange-600 group-hover:scale-110 transition-transform shadow-lg shadow-yellow-500/30">
                      <div className="w-10 h-10 text-white">
                        <svg viewBox="0 0 24 24" className="w-full h-full" fill="currentColor">
                          <path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z"/>
                          <path d="M19 15L19.91 17.53L23 18L19.91 18.47L19 21L18.09 18.47L15 18L18.09 17.53L19 15Z"/>
                          <path d="M5 15L5.91 17.53L9 18L5.91 18.47L5 21L4.09 18.47L1 18L4.09 17.53L5 15Z"/>
                        </svg>
                      </div>
                    </div>
                    <h3 className="text-xl font-black text-white mb-4">Maximum Potential</h3>
                    <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400 counter-animate mb-3">25+</div>
                    <div className="text-gray-200 font-bold mb-4">points per day</div>
                    <div className="inline-flex items-center gap-2 text-xs text-yellow-300 font-bold bg-yellow-900/50 px-4 py-2 rounded-full border border-yellow-500/30">
                      STAKE + HOLD
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Points Usage Info */}
            <motion.div
              className="mt-20 text-center relative"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.5 }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-3xl blur-3xl"></div>
              <div className="relative bg-black/50 backdrop-blur-2xl border border-purple-500/40 rounded-3xl p-12 overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl"></div>
                <div className="relative z-10">
                  <div className="w-24 h-24 rounded-3xl mx-auto mb-8 flex items-center justify-center bg-gradient-to-br from-purple-600 to-pink-600 shadow-2xl shadow-purple-500/50">
                    <div className="w-12 h-12 text-white">
                      <Icons.Dice />
                    </div>
                  </div>
                  <h3 className="text-3xl sm:text-4xl font-black text-white mb-6">
                    Use Your Points for Premium Raffles
                  </h3>
                  <p className="text-lg text-gray-200 max-w-3xl mx-auto leading-relaxed mb-8">
                    Accumulated points can be spent to enter exclusive raffles featuring rare NFTs, tokens,
                    and other valuable prizes. The more points you earn, the more opportunities you have to win big!
                  </p>
                  <div className="flex flex-wrap justify-center gap-4">
                    <div className="inline-flex items-center gap-2 text-sm text-purple-300 font-bold bg-purple-900/50 px-5 py-3 rounded-full border border-purple-500/30">
                      <div className="w-2 h-2 rounded-full bg-purple-400"></div>
                      NFT PRIZES
                    </div>
                    <div className="inline-flex items-center gap-2 text-sm text-pink-300 font-bold bg-pink-900/50 px-5 py-3 rounded-full border border-pink-500/30">
                      <div className="w-2 h-2 rounded-full bg-pink-400"></div>
                      TOKEN REWARDS
                    </div>
                    <div className="inline-flex items-center gap-2 text-sm text-blue-300 font-bold bg-blue-900/50 px-5 py-3 rounded-full border border-blue-500/30">
                      <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                      EXCLUSIVE ACCESS
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* Futuristic CTA */}
          <motion.div
            className="text-center mt-20"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            {isConnected && session ? (
              <motion.button
                onClick={handleEnterPortal}
                className="relative group px-12 py-6 text-xl font-black rounded-2xl overflow-hidden"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 bg-[length:200%_100%] animate-gradient"></div>
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 blur-2xl"></div>
                </div>
                <span className="relative z-10 flex items-center gap-3 tracking-wide">
                  <span>START EARNING REWARDS</span>
                  <svg className="w-6 h-6 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
              </motion.button>
            ) : (
              <CustomConnectButton size="xl" />
            )}
            
            <motion.p 
              className="text-gray-300 mt-6 text-lg"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.8 }}
            >
              Join{' '}
              <span className="font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                2,222 Shellies
              </span>
              {' '}holders earning daily
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* Futuristic Footer */}
      <footer className="relative py-20 bg-black/50 text-white border-t border-purple-500/20 overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
        <div className="absolute top-0 left-1/4 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-pink-600/10 rounded-full blur-3xl"></div>
        
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center">
            <motion.div 
              className="flex items-center justify-center space-x-4 mb-8"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center overflow-hidden relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500 opacity-50 group-hover:opacity-100 transition-opacity blur-xl"></div>
                <img
                  src="/shellies_icon.jpg"
                  alt="Shellies Logo"
                  className="w-full h-full object-cover rounded-2xl relative z-10"
                />
              </div>
              <span className="text-3xl shellies-brand tracking-wider" data-text="SHELLIES">SHELLIES</span>
            </motion.div>
            
            <motion.p 
              className="text-gray-200 text-lg mb-3 max-w-2xl mx-auto font-medium"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
            >
              The premier raffle platform for Ink Chain's SHELLIES NFT collection.
            </motion.p>
            
            <motion.p 
              className="text-gray-300 text-base mb-8 max-w-2xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
            >
              Built for the community, powered by innovation.
            </motion.p>
            
            <motion.div
              className="inline-flex items-center gap-3 px-6 py-3 bg-black/40 backdrop-blur-xl border border-purple-500/30 rounded-full"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
            >
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
              <span className="text-gray-300 text-sm font-bold tracking-wide">
                © 2025 INK SHELLIES PLATFORM. ALL RIGHTS RESERVED.
              </span>
            </motion.div>
          </div>
        </div>
      </footer>
    </div>
  );
}