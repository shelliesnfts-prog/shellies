'use client';

import { useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

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
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-black/20 backdrop-blur-md border-b border-white/10 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="text-2xl font-bold text-white">
              Shellies Raffles
            </div>
            <div className="hidden md:flex space-x-8">
              <button
                onClick={() => scrollToSection('home')}
                className={`text-sm font-medium transition-colors ${
                  activeSection === 'home' ? 'text-purple-400' : 'text-white hover:text-purple-300'
                }`}
              >
                Home
              </button>
              <button
                onClick={() => scrollToSection('about')}
                className={`text-sm font-medium transition-colors ${
                  activeSection === 'about' ? 'text-purple-400' : 'text-white hover:text-purple-300'
                }`}
              >
                About
              </button>
            </div>
            {isConnected && session ? (
              <button
                onClick={handleEnterPortal}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-6 py-2 rounded-lg font-medium transition-all duration-200 transform hover:scale-105"
              >
                Go to Portal
              </button>
            ) : (
              <ConnectButton />
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section id="home" className="pt-20 min-h-screen flex items-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center">
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">
              Welcome to{' '}
              <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                Shellies Raffles
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 mb-12 max-w-3xl mx-auto">
              Join exclusive NFT raffles and win amazing prizes. Connect your Ink blockchain wallet and compete with fellow Shellies holders.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              {isConnected && session ? (
                <button
                  onClick={handleEnterPortal}
                  className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-8 py-4 rounded-lg font-bold text-lg transition-all duration-200 transform hover:scale-105 shadow-lg"
                >
                  Go to Portal
                </button>
              ) : (
                <div className="mb-4">
                  <ConnectButton />
                </div>
              )}
              <button
                onClick={() => scrollToSection('about')}
                className="border-2 border-purple-400 text-purple-400 hover:bg-purple-400 hover:text-white px-8 py-4 rounded-lg font-bold text-lg transition-all duration-200"
              >
                Learn More
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20 bg-black/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              About Shellies Raffles
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              A revolutionary raffle platform designed exclusively for Shellies NFT holders on the Ink blockchain.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-8 border border-white/20">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg mb-6 flex items-center justify-center">
                <span className="text-2xl">🎯</span>
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Earn Points</h3>
              <p className="text-gray-300">
                Claim daily points based on your Shellies NFT holdings. The more NFTs you hold, the more points you earn every 24 hours.
              </p>
            </div>
            
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-8 border border-white/20">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg mb-6 flex items-center justify-center">
                <span className="text-2xl">🎲</span>
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Join Raffles</h3>
              <p className="text-gray-300">
                Use your earned points to participate in exclusive raffles featuring rare NFTs and amazing prizes.
              </p>
            </div>
            
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-8 border border-white/20">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg mb-6 flex items-center justify-center">
                <span className="text-2xl">🏆</span>
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Win Big</h3>
              <p className="text-gray-300">
                Compete on the leaderboard and increase your chances of winning exclusive NFT drops and special prizes.
              </p>
            </div>
          </div>
          
          <div className="text-center mt-16">
            {isConnected && session ? (
              <button
                onClick={handleEnterPortal}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-8 py-4 rounded-lg font-bold text-lg transition-all duration-200 transform hover:scale-105 shadow-lg"
              >
                Go to Portal
              </button>
            ) : (
              <ConnectButton />
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-gray-400">
            © 2024 Shellies Raffles. Powered by Ink Blockchain.
          </p>
        </div>
      </footer>
    </div>
  );
}
