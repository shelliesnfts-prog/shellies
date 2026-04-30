'use client';

import React from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Wallet } from 'lucide-react';

interface WalletRequiredProps {
  variant?: 'compact' | 'card';
  action?: string;
  isDarkMode: boolean;
  icon?: React.ReactNode;
  title?: string;
}

export function WalletRequired({
  variant = 'card',
  action = 'connect to view your profile',
  isDarkMode,
  icon,
  title = 'Wallet required',
}: WalletRequiredProps) {
  const padding = variant === 'compact' ? 'p-4' : 'p-8 sm:p-12';
  const iconSize = variant === 'compact' ? 'w-7 h-7' : 'w-10 h-10';
  const iconContainer = variant === 'compact'
    ? 'w-10 h-10 rounded-lg'
    : 'w-14 h-14 rounded-xl';

  return (
    <div
      className={`rounded-2xl border text-center space-y-5 ${padding} ${
        isDarkMode
          ? 'bg-gray-800 border-gray-700'
          : 'bg-white border-gray-200'
      }`}
    >
      <div
        className={`${iconContainer} mx-auto flex items-center justify-center ${
          isDarkMode ? 'bg-purple-500/15' : 'bg-purple-100'
        }`}
      >
        {icon || <Wallet className={`${iconSize} text-purple-500`} />}
      </div>

      <div>
        <h3
          className={`font-semibold ${
            variant === 'compact' ? 'text-base' : 'text-lg'
          } ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
        >
          {title}
        </h3>
        <p
          className={`text-sm mt-1 ${
            isDarkMode ? 'text-gray-400' : 'text-gray-500'
          }`}
        >
          {action}
        </p>
      </div>

      <div className="flex justify-center">
        <ConnectButton />
      </div>

      <p
        className={`text-xs ${
          isDarkMode ? 'text-gray-500' : 'text-gray-400'
        }`}
      >
        Your wallet stays in your control. We never store private keys.
      </p>
    </div>
  );
}
