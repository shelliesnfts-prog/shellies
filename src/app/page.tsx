'use client';

import { useState, useEffect, useRef } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

// Simple counter component
function AnimatedCounter({ end, duration = 1500 }) {
  const [count, setCount] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          let startTime = null;
          
          const animate = (currentTime) => {
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

  const scrollToSection = (sectionId) => {
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
      {/* Clean Navigation */}
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-sm border-b border-gray-200 z-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">IS</span>
              </div>
              <span className="text-xl font-bold text-gray-900">
                Ink Shellies
              </span>
            </div>
            
            <div className="hidden md:flex items-center space-x-8">
              <button
                onClick={() => scrollToSection('home')}
                className={`text-sm font-medium px-4 py-2 rounded-lg transition-colors ${
                  activeSection === 'home' 
                    ? 'text-purple-600 bg-purple-50' 
                    : 'text-gray-600 hover:text-purple-600 hover:bg-gray-50'
                }`}
              >
                Home
              </button>
              <button
                onClick={() => scrollToSection('about')}
                className={`text-sm font-medium px-4 py-2 rounded-lg transition-colors ${
                  activeSection === 'about' 
                    ? 'text-purple-600 bg-purple-50' 
                    : 'text-gray-600 hover:text-purple-600 hover:bg-gray-50'
                }`}
              >
                About
              </button>
            </div>
            
            {isConnected && session ? (
              <button
                onClick={handleEnterPortal}
                className="btn-primary"
              >
                Enter Portal
              </button>
            ) : (
              <div className="scale-95">
                <ConnectButton />
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section id="home" className="pt-24 pb-20 min-h-screen flex items-center">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center">
            {/* Badge */}
            <div className="inline-flex items-center px-4 py-2 bg-purple-50 border border-purple-200 rounded-full mb-8">
              <div className="w-2 h-2 bg-purple-600 rounded-full mr-3"></div>
              <span className="text-purple-700 text-sm font-medium">
                First PFP Collection on Ink Chain
              </span>
            </div>

            {/* Main Heading */}
            <motion.h1 
              className="text-5xl sm:text-6xl lg:text-7xl font-bold text-gray-900 mb-6 leading-tight"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <span className="text-gradient block">
                Ink Shellies
              </span>
            </motion.h1>

            {/* Description */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mb-12"
            >
              <p className="text-xl sm:text-2xl text-gray-600 mb-4 max-w-4xl mx-auto">
                3,333 Shellies are swimming in the
              </p>
              <p className="text-xl sm:text-2xl text-gray-600 max-w-4xl mx-auto">
                <span className="text-gradient font-semibold">Ink Chain</span> ocean, bringing waves of creativity and fun!
              </p>
            </motion.div>

            {/* CTA Buttons */}
            <motion.div 
              className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              {isConnected && session ? (
                <button
                  onClick={handleEnterPortal}
                  className="btn-primary text-lg px-8 py-4"
                >
                  Enter Portal →
                </button>
              ) : (
                <div className="mb-4">
                  <ConnectButton />
                </div>
              )}
              <button
                onClick={() => scrollToSection('about')}
                className="btn-secondary text-lg px-8 py-4"
              >
                Learn More ↓
              </button>
            </motion.div>

            {/* Stats */}
            <motion.div 
              className="grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-4xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
            >
              <div className="text-center glass-card p-8 rounded-xl hover-lift">
                <AnimatedCounter end={3333} />
                <div className="text-gray-600 font-medium mt-2">Unique NFTs</div>
              </div>
              <div className="text-center glass-card p-8 rounded-xl hover-lift">
                <div className="text-4xl font-bold text-gradient">1st</div>
                <div className="text-gray-600 font-medium mt-2">On Ink Chain</div>
              </div>
              <div className="text-center glass-card p-8 rounded-xl hover-lift">
                <AnimatedCounter end={Infinity} />
                <div className="text-gray-600 font-medium mt-2">Possibilities</div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center px-4 py-2 bg-white border border-gray-200 rounded-full mb-8">
              <span className="text-purple-700 text-sm font-medium">About the Collection</span>
            </div>
            
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-8">
              <span className="text-gradient">Ink Shellies</span>
              <span className="block text-3xl sm:text-4xl lg:text-5xl mt-4 text-gray-700 font-medium">
                is the first PFP collection
              </span>
            </h2>
            
            <h3 className="text-2xl sm:text-3xl text-gray-700 mb-8">
              on <span className="text-gradient font-bold">Ink Chain</span> Mainnet launch day.
            </h3>
            
            <div className="max-w-4xl mx-auto">
              <p className="text-xl sm:text-2xl text-purple-600 font-semibold mb-6">
                3,333 unique Shellies, packed with benefits.
              </p>
              <p className="text-lg text-gray-600 leading-relaxed">
                A revolutionary raffle platform designed exclusively for Ink Shellies NFT holders, 
                celebrating the inaugural collection of the Ink blockchain ecosystem.
              </p>
            </div>
          </div>
          
          {/* Feature Cards */}
          <div className="grid lg:grid-cols-3 gap-8 mb-16">
            <div className="bg-white rounded-xl p-8 shadow-lg hover-lift">
              <div className="w-16 h-16 bg-purple-100 rounded-lg mb-6 flex items-center justify-center">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Earn Points</h3>
              <p className="text-gray-600 leading-relaxed">
                Claim daily points based on your Ink Shellies NFT holdings. The more NFTs you hold, 
                the more points you earn every 24 hours.
              </p>
            </div>
            
            <div className="bg-white rounded-xl p-8 shadow-lg hover-lift">
              <div className="w-16 h-16 bg-purple-100 rounded-lg mb-6 flex items-center justify-center">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Join Raffles</h3>
              <p className="text-gray-600 leading-relaxed">
                Use your earned points to participate in exclusive raffles featuring rare NFTs 
                and amazing prizes from the Ink ecosystem.
              </p>
            </div>
            
            <div className="bg-white rounded-xl p-8 shadow-lg hover-lift">
              <div className="w-16 h-16 bg-purple-100 rounded-lg mb-6 flex items-center justify-center">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Win Exclusive Prizes</h3>
              <p className="text-gray-600 leading-relaxed">
                Compete on the leaderboard and increase your chances of winning exclusive NFT drops 
                and special prizes from the first PFP collection.
              </p>
            </div>
          </div>
          
          {/* CTA */}
          <div className="text-center">
            {isConnected && session ? (
              <button
                onClick={handleEnterPortal}
                className="btn-primary text-lg px-10 py-4"
              >
                Enter Portal →
              </button>
            ) : (
              <div className="inline-block">
                <ConnectButton />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 bg-white border-t border-gray-200">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold">IS</span>
              </div>
              <h4 className="text-2xl font-bold text-gray-900">
                Ink Shellies
              </h4>
            </div>
            <p className="text-purple-600 text-lg font-medium">
              The first PFP collection on Ink Chain
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <div className="text-center">
              <h5 className="text-gray-900 font-semibold mb-4">Collection</h5>
              <ul className="space-y-2 text-gray-600">
                <li>3,333 Unique NFTs</li>
                <li>Ink Chain Native</li>
                <li>First PFP Launch</li>
              </ul>
            </div>
            <div className="text-center">
              <h5 className="text-gray-900 font-semibold mb-4">Platform</h5>
              <ul className="space-y-2 text-gray-600">
                <li>Raffle System</li>
                <li>Points Rewards</li>
                <li>Leaderboards</li>
              </ul>
            </div>
            <div className="text-center">
              <h5 className="text-gray-900 font-semibold mb-4">Community</h5>
              <ul className="space-y-2 text-gray-600">
                <li>Exclusive Access</li>
                <li>Special Events</li>
                <li>NFT Holder Benefits</li>
              </ul>
            </div>
          </div>
          
          <div className="text-center pt-8 border-t border-gray-200">
            <p className="text-gray-500">
              © 2024 Ink Shellies. Powered by{' '}
              <span className="text-purple-600 font-semibold">
                Ink Blockchain
              </span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}