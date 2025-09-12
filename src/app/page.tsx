'use client';

import { useState, useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
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
  const { isConnected } = useAccount();
  const { data: session } = useSession();
  const router = useRouter();

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
    <div className="min-h-screen bg-white">
      {/* Professional Navigation */}
      <nav className="fixed top-0 w-full bg-white/95 backdrop-blur-xl border-b border-gray-200/50 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 icon-gradient rounded-xl flex items-center justify-center">
                <div className="w-6 h-6 text-white">
                  <Icons.Shell />
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-bold text-gray-900">Ink Shellies</span>
                <span className="text-xs text-purple-600 font-medium">Raffle Platform</span>
              </div>
            </div>
            
            <div className="hidden md:flex items-center space-x-4">
              <button
                onClick={() => scrollToSection('home')}
                className={`text-sm font-medium px-4 py-2 rounded-lg transition-all duration-200 ${
                  activeSection === 'home' 
                    ? 'text-white bg-purple-600 shadow-md' 
                    : 'text-gray-700 hover:text-purple-600 hover:bg-gray-50'
                }`}
              >
                Home
              </button>
              <button
                onClick={() => scrollToSection('about')}
                className={`text-sm font-medium px-4 py-2 rounded-lg transition-all duration-200 ${
                  activeSection === 'about' 
                    ? 'text-white bg-purple-600 shadow-md' 
                    : 'text-gray-700 hover:text-purple-600 hover:bg-gray-50'
                }`}
              >
                About
              </button>
            </div>
            
            {isConnected && session ? (
              <button
                onClick={handleEnterPortal}
                className="btn-primary px-6 py-2.5 text-sm font-medium shadow-lg"
              >
                Enter Portal
              </button>
            ) : (
              <CustomConnectButton size="sm" />
            )}
          </div>
        </div>
      </nav>

      {/* Professional Hero Section */}
      <section id="home" className="pt-20 pb-24 min-h-screen flex items-center relative overflow-hidden bg-gradient-to-br from-gray-50 via-white to-purple-50/30">
        {/* Subtle Background Elements */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-32 left-16 w-24 h-24 bg-gradient-to-br from-purple-400 to-purple-500 rounded-full blur-2xl floating"></div>
          <div className="absolute bottom-40 right-20 w-32 h-32 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full blur-3xl floating" style={{animationDelay: '2s'}}></div>
          <div className="absolute top-1/3 right-1/4 w-16 h-16 bg-gradient-to-br from-purple-300 to-purple-400 rounded-full blur-xl floating" style={{animationDelay: '4s'}}></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center">
            {/* Professional Badge */}
            <motion.div 
              className="inline-flex items-center px-4 py-2 bg-white/80 backdrop-blur-sm border border-purple-200/50 rounded-full mb-8 shadow-sm"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
            >
              <div className="w-2 h-2 bg-gradient-to-r from-purple-500 to-purple-600 rounded-full mr-2"></div>
              <span className="text-purple-700 text-sm font-medium">
                First PFP Collection on Ink Chain
              </span>
            </motion.div>

            {/* Clean Main Heading */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="mb-6"
            >
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-gray-900 mb-4">
                <span className="text-gradient block">Ink Shellies</span>
              </h1>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-600">
                Premium Raffle Platform
              </h2>
            </motion.div>

            {/* Professional Description */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mb-12"
            >
              <p className="text-xl sm:text-2xl text-gray-600 max-w-4xl mx-auto leading-relaxed mb-4">
                Exclusive raffle ecosystem for holders of the first NFT collection on <span className="text-gradient font-semibold">Ink Chain</span>
              </p>
              <p className="text-lg text-gray-500 max-w-3xl mx-auto">
                Stake your Shellies, earn daily rewards, and participate in premium raffles with incredible prizes
              </p>
            </motion.div>

            {/* Professional CTA Buttons */}
            <motion.div 
              className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
            >
              {isConnected && session ? (
                <button
                  onClick={handleEnterPortal}
                  className="btn-primary text-lg px-8 py-4 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all font-semibold"
                >
                  Enter Raffle Portal
                </button>
              ) : (
                <CustomConnectButton size="lg" />
              )}
              <button
                onClick={() => scrollToSection('about')}
                className="btn-secondary text-lg px-8 py-4 font-medium hover:shadow-lg transform hover:-translate-y-0.5 transition-all"
              >
                Learn More
              </button>
            </motion.div>

            {/* Professional Stats */}
            <motion.div 
              className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-5xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.7 }}
            >
              <div className="text-center modern-card p-8 group hover:scale-105 transition-transform duration-300">
                <div className="w-16 h-16 icon-gradient rounded-2xl mx-auto mb-4 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <div className="w-8 h-8 text-white">
                    <Icons.Shell />
                  </div>
                </div>
                <AnimatedCounter end={3333} />
                <div className="text-gray-600 font-medium mt-2">Unique NFTs</div>
                <div className="text-sm text-purple-600 font-medium mt-1">In Collection</div>
              </div>
              
              <div className="text-center modern-card p-8 group hover:scale-105 transition-transform duration-300">
                <div className="w-16 h-16 icon-gradient rounded-2xl mx-auto mb-4 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <div className="w-8 h-8 text-white">
                    <Icons.Trophy />
                  </div>
                </div>
                <div className="text-4xl font-black text-gradient mb-2">#1</div>
                <div className="text-gray-600 font-medium mt-2">First Collection</div>
                <div className="text-sm text-purple-600 font-medium mt-1">On Ink Chain</div>
              </div>
              
              <div className="text-center modern-card p-8 group hover:scale-105 transition-transform duration-300">
                <div className="w-16 h-16 icon-gradient rounded-2xl mx-auto mb-4 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <div className="w-8 h-8 text-white">
                    <Icons.Infinity />
                  </div>
                </div>
                <AnimatedCounter end={Infinity} />
                <div className="text-gray-600 font-medium mt-2">Prize Pool</div>
                <div className="text-sm text-purple-600 font-medium mt-1">Opportunities</div>
              </div>
            </motion.div>
            
            {/* Professional Trust Indicators */}
            <motion.div 
              className="flex justify-center items-center space-x-12 mt-12"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 1 }}
            >
              <div className="flex items-center space-x-2 text-gray-500">
                <div className="w-5 h-5 text-purple-600">
                  <Icons.Chain />
                </div>
                <span className="text-sm font-medium">Ink Chain Native</span>
              </div>
              <div className="flex items-center space-x-2 text-gray-500">
                <div className="w-5 h-5 text-purple-600">
                  <Icons.Shield />
                </div>
                <span className="text-sm font-medium">Secure & Verified</span>
              </div>
              <div className="flex items-center space-x-2 text-gray-500">
                <div className="w-5 h-5 text-purple-600">
                  <Icons.Coins />
                </div>
                <span className="text-sm font-medium">Premium Rewards</span>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Professional About Section */}
      <section id="about" className="py-24 bg-white relative overflow-hidden">
        {/* Subtle Background Pattern */}
        <div className="absolute inset-0 opacity-3">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%236e36e4' fill-opacity='1'%3E%3Ccircle cx='20' cy='20' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            backgroundSize: '40px 40px'
          }}></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-6 relative z-10 mt-4">
          <div className="text-center mb-16">
            <motion.div 
              className="inline-flex items-center px-4 py-2 bg-purple-50 border border-purple-200/30 rounded-full mb-8"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <span className="text-purple-700 text-sm font-medium">Platform Overview</span>
            </motion.div>
            
            <motion.h2 
              className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              How It Works
            </motion.h2>
            
            <motion.p 
              className="text-xl text-gray-600 mb-4 max-w-3xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              Built exclusively for holders of the first NFT collection on <span className="text-gradient font-semibold">Ink Chain</span>
            </motion.p>
            
            <motion.p 
              className="text-lg text-gray-500 max-w-2xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              Turn your Shellies NFTs into passive income through our innovative staking and raffle system
            </motion.p>
          </div>
          
          {/* Professional Feature Cards */}
          <div className="grid lg:grid-cols-3 gap-8 mb-16">
            <motion.div 
              className="modern-card p-8 text-center group hover:scale-105 transition-all duration-300"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <div className="w-16 h-16 icon-gradient rounded-2xl mx-auto mb-6 flex items-center justify-center group-hover:scale-110 transition-transform">
                <div className="w-8 h-8 text-white">
                  <Icons.Coins />
                </div>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Daily Rewards</h3>
              <p className="text-gray-600 leading-relaxed mb-6">
                Earn points automatically based on your Shellies holdings. More NFTs means higher daily rewards.
              </p>
              <div className="text-sm text-purple-600 font-medium bg-purple-50 px-3 py-1 rounded-full inline-block">
                Passive Income
              </div>
            </motion.div>
            
            <motion.div 
              className="modern-card p-8 text-center group hover:scale-105 transition-all duration-300"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <div className="w-16 h-16 icon-gradient rounded-2xl mx-auto mb-6 flex items-center justify-center group-hover:scale-110 transition-transform">
                <div className="w-8 h-8 text-white">
                  <Icons.Dice />
                </div>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Premium Raffles</h3>
              <p className="text-gray-600 leading-relaxed mb-6">
                Enter exclusive raffles using your earned points. Win rare NFTs, tokens, and premium prizes.
              </p>
              <div className="text-sm text-purple-600 font-medium bg-purple-50 px-3 py-1 rounded-full inline-block">
                High-Value Prizes
              </div>
            </motion.div>
            
            <motion.div 
              className="modern-card p-8 text-center group hover:scale-105 transition-all duration-300"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <div className="w-16 h-16 icon-gradient rounded-2xl mx-auto mb-6 flex items-center justify-center group-hover:scale-110 transition-transform">
                <div className="w-8 h-8 text-white">
                  <Icons.Trophy />
                </div>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Leaderboard</h3>
              <p className="text-gray-600 leading-relaxed mb-6">
                Compete with other holders on the community leaderboard for special bonuses and recognition.
              </p>
              <div className="text-sm text-purple-600 font-medium bg-purple-50 px-3 py-1 rounded-full inline-block">
                Community Status
              </div>
            </motion.div>
          </div>
          
          {/* Professional CTA */}
          <motion.div 
            className="text-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            {isConnected && session ? (
              <button
                onClick={handleEnterPortal}
                className="btn-primary text-lg px-8 py-4 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all font-semibold"
              >
                Start Earning Rewards
              </button>
            ) : (
              <CustomConnectButton size="xl" />
            )}
            
            <p className="text-gray-500 mt-4 text-base">
              Join <span className="font-medium text-purple-600">3,333 Shellies</span> holders earning daily
            </p>
          </motion.div>
        </div>
      </section>

      {/* Professional Footer */}
      <footer className="py-16 bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-3 mb-6">
              <div className="w-8 h-8 icon-gradient rounded-lg flex items-center justify-center">
                <div className="w-5 h-5 text-white">
                  <Icons.Shell />
                </div>
              </div>
              <span className="text-xl font-bold">Ink Shellies</span>
            </div>
            
            <p className="text-gray-400 text-base mb-2 max-w-2xl mx-auto">
              The premier raffle platform for Ink Chain's first NFT collection.
              Built for the community, powered by innovation.
            </p>
            
            <p className="text-gray-500 text-sm">
              © 2025 Ink Shellies Platform. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}