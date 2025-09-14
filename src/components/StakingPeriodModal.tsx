'use client';

import { useState } from 'react';
import { useWriteContract } from 'wagmi';
import { X, Lock, Loader2, CheckCircle, AlertTriangle, Clock, Calendar, CalendarDays } from 'lucide-react';
import { staking_abi } from '@/lib/staking-abi';
import { LockPeriod, StakingService } from '@/lib/staking-service';
import { parseContractError } from '@/lib/errors';

interface StakingPeriodModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTokens: number[];
  stakingContractAddress: string;
  isDarkMode?: boolean;
  onSuccess?: () => void;
  userAddress: string;
}

type StakingStatus = 'idle' | 'pending' | 'success' | 'error';

export default function StakingPeriodModal({
  isOpen,
  onClose,
  selectedTokens,
  stakingContractAddress,
  isDarkMode = false,
  onSuccess,
  userAddress
}: StakingPeriodModalProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<LockPeriod>(LockPeriod.DAY);
  const [stakingStatus, setStakingStatus] = useState<StakingStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [transactionHash, setTransactionHash] = useState<string>('');

  const { writeContractAsync } = useWriteContract();

  const lockPeriodOptions = [
    {
      period: LockPeriod.DAY,
      label: '1 Day',
      description: 'Lock for 24 hours',
      icon: Clock,
      color: 'blue',
      duration: '1 day'
    },
    {
      period: LockPeriod.WEEK,
      label: '1 Week',
      description: 'Lock for 7 days',
      icon: Calendar,
      color: 'purple',
      duration: '7 days'
    },
    {
      period: LockPeriod.MONTH,
      label: '1 Month',
      description: 'Lock for 30 days',
      icon: CalendarDays,
      color: 'green',
      duration: '30 days'
    }
  ];

  const handleStake = async () => {
    if (!selectedTokens.length || !stakingContractAddress) {
      return;
    }

    try {
      setError(null);
      setStakingStatus('pending');

      const tokenIds = selectedTokens.map(id => BigInt(id));

      const hash = await writeContractAsync({
        address: stakingContractAddress as `0x${string}`,
        abi: staking_abi,
        functionName: 'stakeBatch',
        args: [tokenIds, selectedPeriod],
      });

      setTransactionHash(hash);

      // Wait for transaction confirmation
      await new Promise(resolve => setTimeout(resolve, 3000));

      setStakingStatus('success');

      // Call success handler and close modal after brief delay
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1500);

    } catch (error: any) {
      console.error('Staking failed:', error);
      setStakingStatus('error');

      let errorMessage = 'Failed to stake tokens';
      if (error?.message?.includes('User rejected')) {
        errorMessage = 'Transaction was cancelled by user';
      } else if (error?.message?.includes('insufficient funds')) {
        errorMessage = 'Insufficient funds for gas fees';
      } else {
        errorMessage = parseContractError(error) || error?.message?.slice(0, 100) || 'Failed to stake tokens';
      }

      setError(errorMessage);
    }
  };

  const getColorClasses = (color: string, isSelected: boolean) => {
    const colors = {
      blue: {
        bg: isSelected
          ? (isDarkMode ? 'bg-blue-900/40 border-blue-500' : 'bg-blue-50 border-blue-500')
          : (isDarkMode ? 'bg-gray-800 border-gray-600 hover:border-blue-400' : 'bg-white border-gray-200 hover:border-blue-300'),
        icon: 'text-blue-500',
        text: isDarkMode ? 'text-blue-400' : 'text-blue-600'
      },
      purple: {
        bg: isSelected
          ? (isDarkMode ? 'bg-purple-900/40 border-purple-500' : 'bg-purple-50 border-purple-500')
          : (isDarkMode ? 'bg-gray-800 border-gray-600 hover:border-purple-400' : 'bg-white border-gray-200 hover:border-purple-300'),
        icon: 'text-purple-500',
        text: isDarkMode ? 'text-purple-400' : 'text-purple-600'
      },
      green: {
        bg: isSelected
          ? (isDarkMode ? 'bg-green-900/40 border-green-500' : 'bg-green-50 border-green-500')
          : (isDarkMode ? 'bg-gray-800 border-gray-600 hover:border-green-400' : 'bg-white border-gray-200 hover:border-green-300'),
        icon: 'text-green-500',
        text: isDarkMode ? 'text-green-400' : 'text-green-600'
      }
    };
    return colors[color as keyof typeof colors] || colors.blue;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`relative w-full max-w-lg rounded-2xl shadow-2xl ${
        isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className={`p-2.5 rounded-xl ${
              isDarkMode ? 'bg-blue-500/20' : 'bg-blue-100'
            }`}>
              <Lock className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className={`text-xl font-bold ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>
                Choose Lock Period
              </h3>
              <p className={`text-sm ${
                isDarkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                {selectedTokens.length} NFT{selectedTokens.length > 1 ? 's' : ''} selected
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={stakingStatus === 'pending'}
            className={`p-2 rounded-lg transition-colors ${
              isDarkMode
                ? 'hover:bg-gray-700 text-gray-400 hover:text-white'
                : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Period Selection */}
          <div className="space-y-4">
            <div>
              <h4 className={`text-lg font-semibold mb-2 ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>
                Select Lock Period
              </h4>
              <p className={`text-sm ${
                isDarkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Choose how long your NFTs will be locked for staking
              </p>
            </div>

            <div className="grid gap-3">
              {lockPeriodOptions.map((option) => {
                const isSelected = selectedPeriod === option.period;
                const colors = getColorClasses(option.color, isSelected);
                const IconComponent = option.icon;

                return (
                  <button
                    key={option.period}
                    onClick={() => setSelectedPeriod(option.period)}
                    disabled={stakingStatus === 'pending'}
                    className={`flex items-center space-x-4 p-4 rounded-xl border-2 transition-all duration-200 hover:scale-[1.02] ${
                      colors.bg
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <div className={`p-2 rounded-lg ${
                      isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'
                    }`}>
                      <IconComponent className={`w-5 h-5 ${colors.icon}`} />
                    </div>
                    <div className="flex-grow text-left">
                      <h5 className={`font-semibold ${
                        isDarkMode ? 'text-white' : 'text-gray-900'
                      }`}>
                        {option.label}
                      </h5>
                      <p className={`text-sm ${
                        isDarkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        {option.description}
                      </p>
                    </div>
                    <div className={`text-sm font-medium ${colors.text}`}>
                      {option.duration}
                    </div>
                    {isSelected && (
                      <CheckCircle className={`w-5 h-5 ${colors.icon}`} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Staking Info */}
          <div className={`p-4 rounded-xl border ${
            isDarkMode ? 'bg-gray-700/30 border-gray-600' : 'bg-gray-50 border-gray-200'
          }`}>
            <div className="flex items-center space-x-2 mb-2">
              <Lock className={`w-4 h-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
              <span className={`text-sm font-medium ${
                isDarkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Important Information
              </span>
            </div>
            <ul className={`text-sm space-y-1 ${
              isDarkMode ? 'text-gray-400' : 'text-gray-600'
            }`}>
              <li>• Your NFTs will be locked for the selected period</li>
              <li>• You'll earn 10 points per day for each staked NFT</li>
              <li>• You cannot unstake until the lock period ends</li>
              <li>• Emergency unstake is only available if enabled by admin</li>
            </ul>
          </div>

          {/* Transaction Status */}
          {stakingStatus !== 'idle' && (
            <div className={`rounded-xl border p-4 ${
              stakingStatus === 'success'
                ? (isDarkMode ? 'bg-green-900/20 border-green-700' : 'bg-green-50 border-green-200')
                : stakingStatus === 'error'
                ? (isDarkMode ? 'bg-red-900/20 border-red-700' : 'bg-red-50 border-red-200')
                : (isDarkMode ? 'bg-blue-900/20 border-blue-700' : 'bg-blue-50 border-blue-200')
            }`}>
              <div className="flex items-center gap-3">
                {stakingStatus === 'pending' && <Loader2 className="w-5 h-5 animate-spin text-blue-500" />}
                {stakingStatus === 'success' && <CheckCircle className="w-5 h-5 text-green-500" />}
                {stakingStatus === 'error' && <AlertTriangle className="w-5 h-5 text-red-500" />}
                <div>
                  <p className={`text-sm font-medium ${
                    stakingStatus === 'success'
                      ? (isDarkMode ? 'text-green-400' : 'text-green-800')
                      : stakingStatus === 'error'
                      ? (isDarkMode ? 'text-red-400' : 'text-red-800')
                      : (isDarkMode ? 'text-blue-400' : 'text-blue-800')
                  }`}>
                    {stakingStatus === 'pending' && 'Processing staking transaction...'}
                    {stakingStatus === 'success' && 'NFTs staked successfully!'}
                    {stakingStatus === 'error' && error}
                  </p>
                  {transactionHash && (
                    <p className={`text-xs mt-1 ${
                      isDarkMode ? 'text-gray-500' : 'text-gray-500'
                    }`}>
                      Tx: {transactionHash.slice(0, 10)}...{transactionHash.slice(-8)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              disabled={stakingStatus === 'pending'}
              className={`flex-1 px-4 py-3 rounded-xl font-medium transition-colors ${
                isDarkMode
                  ? 'bg-gray-700 text-white hover:bg-gray-600 disabled:opacity-50'
                  : 'bg-gray-200 text-gray-900 hover:bg-gray-300 disabled:opacity-50'
              } disabled:cursor-not-allowed`}
            >
              {stakingStatus === 'pending' ? 'Processing...' : 'Cancel'}
            </button>

            <button
              onClick={handleStake}
              disabled={stakingStatus === 'pending' || stakingStatus === 'success'}
              className={`flex-1 px-4 py-3 rounded-xl font-medium transition-colors ${
                stakingStatus === 'pending' || stakingStatus === 'success'
                  ? 'bg-gray-400 text-white cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700'
              } disabled:opacity-50`}
            >
              {stakingStatus === 'pending' ? (
                <div className="flex items-center justify-center space-x-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Staking...</span>
                </div>
              ) : (
                `Stake for ${StakingService.getLockPeriodLabel(selectedPeriod)}`
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}