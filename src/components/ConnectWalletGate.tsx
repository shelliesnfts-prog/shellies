'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { X, Wallet } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

interface ConnectWalletGateProps {
  isOpen: boolean;
  onClose: () => void;
  /** Short description of what requires the wallet, e.g. "join this raffle" */
  action?: string;
}

export function ConnectWalletGate({ isOpen, onClose, action = 'continue' }: ConnectWalletGateProps) {
  const { isDarkMode } = useTheme();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className={`relative w-full max-w-sm rounded-2xl border shadow-2xl p-6 space-y-6 ${
        isDarkMode
          ? 'bg-gray-900 border-gray-700'
          : 'bg-white border-gray-200'
      }`}>
        {/* Close */}
        <button
          onClick={onClose}
          className={`absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
            isDarkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
          }`}
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center shadow-lg shadow-purple-600/30">
            <Wallet className="w-7 h-7 text-white" />
          </div>
        </div>

        {/* Copy */}
        <div className="text-center space-y-2">
          <h2 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Connect your wallet
          </h2>
          <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            You need to connect your wallet to {action}.
          </p>
        </div>

        {/* Connect button */}
        <div className="flex justify-center">
          <ConnectButton />
        </div>
      </div>
    </div>
  );
}
