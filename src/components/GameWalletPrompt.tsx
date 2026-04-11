'use client';

import { Shield, Trophy, Gamepad2, Sparkles } from 'lucide-react';
import CustomConnectButton from './CustomConnectButton';
import Link from 'next/link';

export default function GameWalletPrompt() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-8">
        {/* Icon */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-purple-600 text-white">
          <Gamepad2 className="w-8 h-8" />
        </div>

        {/* Copy */}
        <div className="space-y-3">
          <h1 className="text-3xl font-bold text-white">
            Shellies Game
          </h1>
          <p className="text-gray-400 text-base leading-relaxed">
            Connect your wallet to play, track scores, and compete on the leaderboard.
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="space-y-2">
            <div className="mx-auto w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center">
              <Shield className="w-5 h-5 text-purple-400" />
            </div>
            <p className="text-xs text-gray-500">Secure scores</p>
          </div>
          <div className="space-y-2">
            <div className="mx-auto w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-yellow-400" />
            </div>
            <p className="text-xs text-gray-500">Leaderboard</p>
          </div>
          <div className="space-y-2">
            <div className="mx-auto w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-pink-400" />
            </div>
            <p className="text-xs text-gray-500">Earn XP</p>
          </div>
        </div>

        {/* Connect */}
        <div className="space-y-4">
          <CustomConnectButton size="xl" />
          <Link
            href="/"
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
