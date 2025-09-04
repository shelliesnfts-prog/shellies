'use client';

import { useState, useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import CustomConnectButton from '@/components/CustomConnectButton';

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
      {/* Modern Navigation */}
      <nav className="fixed top-0 w-full bg-white/90 backdrop-blur-xl border-b border-white/20 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex justify-between items-center py-5">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 icon-gradient flex items-center justify-center">
                <span className="text-white font-black text-lg">IS</span>
              </div>
              <span className="text-2xl font-bold text-gray-900">
                Ink Shellies
              </span>
            </div>
            
            <div className="hidden md:flex items-center space-x-6">
              <button
                onClick={() => scrollToSection('home')}
                className={`text-sm font-semibold px-5 py-2.5 rounded-full transition-all duration-300 ${
                  activeSection === 'home' 
                    ? 'text-white bg-gradient-to-r from-purple-600 to-purple-700 shadow-lg' 
                    : 'text-gray-600 hover:text-purple-600 hover:bg-purple-50'
                }`}
              >
                Home
              </button>
              <button
                onClick={() => scrollToSection('about')}
                className={`text-sm font-semibold px-5 py-2.5 rounded-full transition-all duration-300 ${
                  activeSection === 'about' 
                    ? 'text-white bg-gradient-to-r from-purple-600 to-purple-700 shadow-lg' 
                    : 'text-gray-600 hover:text-purple-600 hover:bg-purple-50'
                }`}
              >
                About
              </button>
            </div>
            
            {isConnected && session ? (
              <button
                onClick={handleEnterPortal}
                className="btn-primary px-6 py-3 text-lg font-semibold shadow-lg"
              >
                Enter Portal ✨
              </button>
            ) : (
              <CustomConnectButton size="sm" />
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section id="home" className="pt-28 pb-32 min-h-screen flex items-center hero-gradient relative overflow-hidden">
        {/* Floating Background Elements */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-20 left-10 w-32 h-32 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full blur-3xl floating"></div>
          <div className="absolute bottom-32 right-10 w-24 h-24 bg-gradient-to-br from-purple-500 to-purple-700 rounded-full blur-2xl floating" style={{animationDelay: '1s'}}></div>
          <div className="absolute top-1/2 left-1/3 w-16 h-16 bg-gradient-to-br from-purple-300 to-purple-500 rounded-full blur-xl floating" style={{animationDelay: '2s'}}></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center">
            {/* Trust Badge */}
            <motion.div 
              className="inline-flex items-center px-6 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full mb-12 pulse-glow"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
            >
              <div className="w-3 h-3 bg-gradient-to-r from-purple-500 to-purple-600 rounded-full mr-3 animate-pulse"></div>
              <span className="text-purple-700 text-base font-semibold">
                🏆 First PFP Collection on Ink Chain
              </span>
            </motion.div>

            {/* Main Heading */}
            <motion.h1 
              className="heading-xl font-black text-gray-900 mb-8 leading-none"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1 }}
            >
              <span className="text-gradient block mb-4">
                Ink Shellies
              </span>
              <span className="text-4xl sm:text-5xl lg:text-6xl text-gray-700 font-semibold">
                Raffle Platform
              </span>
            </motion.h1>

            {/* Description */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="mb-16"
            >
              <p className="text-2xl sm:text-3xl text-gray-600 mb-6 max-w-5xl mx-auto leading-relaxed">
                <span className="font-bold text-gray-800">3,333 Shellies</span> swimming in the
              </p>
              <p className="text-2xl sm:text-3xl text-gray-600 max-w-5xl mx-auto leading-relaxed">
                <span className="text-gradient font-bold">Ink Chain</span> ocean, unlocking <span className="font-semibold text-gray-800">exclusive raffles</span> & rewards!
              </p>
            </motion.div>

            {/* CTA Buttons */}
            <motion.div 
              className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-20"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.5 }}
            >
              {isConnected && session ? (
                <button
                  onClick={handleEnterPortal}
                  className="btn-primary text-xl px-12 py-5 shadow-2xl transform hover:scale-105 transition-all font-bold"
                >
                  🎯 Enter Raffle Portal
                </button>
              ) : (
                <CustomConnectButton size="lg" />
              )}
              <button
                onClick={() => scrollToSection('about')}
                className="btn-secondary text-xl px-12 py-5 font-semibold transform hover:scale-105 transition-all"
              >
                📖 Discover More
              </button>
            </motion.div>

            {/* Enhanced Stats */}
            <motion.div 
              className="grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-6xl mx-auto"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.7 }}
            >
              <div className="text-center modern-card p-10 stats-card">
                <div className="mb-4">
                  <span className="text-4xl">🐚</span>
                </div>
                <AnimatedCounter end={3333} />
                <div className="text-gray-600 font-semibold mt-3 text-lg">Unique Shellies</div>
                <div className="text-sm text-purple-600 font-medium mt-1">NFT Collection</div>
              </div>
              <div className="text-center modern-card p-10 stats-card">
                <div className="mb-4">
                  <span className="text-4xl">🥇</span>
                </div>
                <div className="text-5xl font-black text-gradient mb-2">1st</div>
                <div className="text-gray-600 font-semibold mt-3 text-lg">Pioneer Project</div>
                <div className="text-sm text-purple-600 font-medium mt-1">On Ink Chain</div>
              </div>
              <div className="text-center modern-card p-10 stats-card">
                <div className="mb-4">
                  <span className="text-4xl">🎰</span>
                </div>
                <AnimatedCounter end={Infinity} />
                <div className="text-gray-600 font-semibold mt-3 text-lg">Raffle Opportunities</div>
                <div className="text-sm text-purple-600 font-medium mt-1">Endless Rewards</div>
              </div>
            </motion.div>
            
            {/* Trust Indicators */}
            <motion.div 
              className="flex justify-center items-center space-x-8 mt-16 opacity-60"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              transition={{ duration: 1, delay: 1 }}
            >
              <div className="text-center">
                <div className="text-2xl mb-1">⛓️</div>
                <span className="text-sm font-medium text-gray-600">Ink Chain Native</span>
              </div>
              <div className="text-center">
                <div className="text-2xl mb-1">🔒</div>
                <span className="text-sm font-medium text-gray-600">Secure & Fair</span>
              </div>
              <div className="text-center">
                <div className="text-2xl mb-1">🎁</div>
                <span className="text-sm font-medium text-gray-600">Exclusive Rewards</span>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-32 bg-gradient-to-br from-gray-50 to-white relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%236e36e4' fill-opacity='1'%3E%3Ccircle cx='30' cy='30' r='4'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            backgroundSize: '60px 60px'
          }}></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center mb-20">
            <motion.div 
              className="inline-flex items-center px-6 py-3 bg-white/80 backdrop-blur-sm border border-purple-200/50 rounded-full mb-12 shadow-lg"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <span className="text-purple-700 text-base font-bold">🎨 About the Platform</span>
            </motion.div>
            
            <motion.h2 
              className="heading-lg font-black text-gray-900 mb-12"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              <span className="text-gradient block mb-4">Ink Shellies</span>
              <span className="text-3xl sm:text-4xl lg:text-5xl text-gray-700 font-semibold block">
                Exclusive Raffle Ecosystem
              </span>
            </motion.h2>
            
            <motion.h3 
              className="text-2xl sm:text-3xl lg:text-4xl text-gray-600 mb-12 max-w-4xl mx-auto leading-relaxed"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              First PFP collection on <span className="text-gradient-secondary font-bold">Ink Chain</span> Mainnet, 
              now powering the <span className="font-bold text-gray-800">ultimate raffle experience</span>.
            </motion.h3>
            
            <motion.div 
              className="max-w-5xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <p className="text-2xl sm:text-3xl text-gradient-secondary font-bold mb-8">
                3,333 unique Shellies = Unlimited raffle opportunities 🎉
              </p>
              <p className="text-xl text-gray-600 leading-relaxed">
                A revolutionary raffle platform designed exclusively for Ink Shellies NFT holders, 
                celebrating the inaugural collection while creating the most engaging reward system 
                in the Ink blockchain ecosystem.
              </p>
            </motion.div>
          </div>
          
          {/* Enhanced Feature Cards */}
          <div className="grid lg:grid-cols-3 gap-10 mb-20">
            <motion.div 
              className="modern-card p-10 text-center group"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              <div className="icon-gradient w-20 h-20 mx-auto mb-8 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="text-4xl">💰</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Daily Point Rewards</h3>
              <p className="text-gray-600 leading-relaxed text-lg">
                Claim daily points based on your Ink Shellies NFT holdings. The more Shellies you own, 
                the more points you accumulate every 24 hours. <span className="font-semibold text-purple-600">Passive earning made simple!</span>
              </p>
              <div className="mt-6 inline-flex items-center text-purple-600 font-semibold">
                <span className="mr-2">🔄</span>
                Auto-accumulating rewards
              </div>
            </motion.div>
            
            <motion.div 
              className="modern-card p-10 text-center group"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <div className="icon-gradient w-20 h-20 mx-auto mb-8 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="text-4xl">🎰</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Exclusive Raffles</h3>
              <p className="text-gray-600 leading-relaxed text-lg">
                Use your earned points to participate in exclusive raffles featuring rare NFTs, 
                amazing prizes, and special drops from the Ink ecosystem. <span className="font-semibold text-purple-600">Your gateway to premium rewards!</span>
              </p>
              <div className="mt-6 inline-flex items-center text-purple-600 font-semibold">
                <span className="mr-2">✨</span>
                Premium prize pool
              </div>
            </motion.div>
            
            <motion.div 
              className="modern-card p-10 text-center group"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <div className="icon-gradient w-20 h-20 mx-auto mb-8 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="text-4xl">🏆</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Leaderboard Competition</h3>
              <p className="text-gray-600 leading-relaxed text-lg">
                Compete on the community leaderboard and increase your chances of winning exclusive NFT drops 
                and special prizes. <span className="font-semibold text-purple-600">Climb the ranks and claim victory!</span>
              </p>
              <div className="mt-6 inline-flex items-center text-purple-600 font-semibold">
                <span className="mr-2">🚀</span>
                Competitive advantage
              </div>
            </motion.div>
          </div>
          
          {/* Call to Action */}
          <motion.div 
            className="text-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            {isConnected && session ? (
              <button
                onClick={handleEnterPortal}
                className="btn-primary text-2xl px-16 py-6 shadow-2xl transform hover:scale-105 transition-all font-bold"
              >
                🎯 Start Your Raffle Journey
              </button>
            ) : (
              <CustomConnectButton size="xl" />
            )}
            
            <p className="text-gray-500 mt-6 text-lg">
              Join the <span className="font-semibold text-purple-600">3,333 Shellies</span> community today!
            </p>
          </motion.div>
        </div>
      </section>

      {/* Simplified Footer */}
      <footer className="py-12 bg-gradient-to-br from-gray-900 via-gray-800 to-purple-900 text-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center">
            <p className="text-gray-400 text-lg">
              © 2025 Ink Shellies Raffle Platform. Pioneering the future with{' '}
              <span className="text-gradient-secondary font-bold">
                Ink Blockchain Technology
              </span>
            </p>
            <p className="text-gray-500 mt-2">
              🔥 Built for the community, powered by innovation
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}