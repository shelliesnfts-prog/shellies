'use client';

import { useState } from 'react';
import { useWriteContract } from 'wagmi';
import { X, Shield, Lock, Loader2, CheckCircle, AlertTriangle, Clock, Calendar, CalendarDays, Star } from 'lucide-react';
import { erc721Abi } from 'viem';
import { staking_abi } from '@/lib/staking-abi';
import { LockPeriod, StakingService } from '@/lib/staking-service';
import { parseContractError } from '@/lib/errors';

interface ApprovalStakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTokens: number[];
  stakingContractAddress: string;
  nftContractAddress: string;
  isDarkMode?: boolean;
  onSuccess?: () => void;
  userAddress: string;
}

type StepStatus = 'pending' | 'in-progress' | 'completed' | 'error';

interface Step {
  id: 'approval' | 'period-selection' | 'staking';
  title: string;
  description: string;
  status: StepStatus;
}

export default function ApprovalStakeModal({
  isOpen,
  onClose,
  selectedTokens,
  stakingContractAddress,
  nftContractAddress,
  isDarkMode = false,
  onSuccess,
  userAddress
}: ApprovalStakeModalProps) {
  const [steps, setSteps] = useState<Step[]>([
    {
      id: 'approval',
      title: 'Approve NFTs',
      description: 'Grant permission to the staking contract',
      status: 'pending'
    },
    {
      id: 'period-selection',
      title: 'Select Lock Period',
      description: 'Choose how long to lock your NFTs',
      status: 'pending'
    },
    {
      id: 'staking',
      title: 'Stake NFTs',
      description: 'Lock your NFTs to start earning points',
      status: 'pending'
    }
  ]);

  const [currentStep, setCurrentStep] = useState<'approval' | 'period-selection' | 'staking'>('approval');
  const [transactionHashes, setTransactionHashes] = useState<{ approval?: string; staking?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<LockPeriod | null>(null);
  const [hasConfirmedPeriod, setHasConfirmedPeriod] = useState(false);

  const { writeContractAsync } = useWriteContract();

  const updateStepStatus = (stepId: 'approval' | 'period-selection' | 'staking', status: StepStatus) => {
    setSteps(prev => prev.map(step =>
      step.id === stepId ? { ...step, status } : step
    ));
  };

  const handleApproval = async () => {
    try {
      setError(null);
      updateStepStatus('approval', 'in-progress');
      setCurrentStep('approval');

      const hash = await writeContractAsync({
        address: nftContractAddress as `0x${string}`,
        abi: erc721Abi,
        functionName: 'setApprovalForAll',
        args: [stakingContractAddress as `0x${string}`, true],
      });

      setTransactionHashes(prev => ({ ...prev, approval: hash }));

      // Wait longer for transaction to be fully mined before proceeding
      await new Promise(resolve => setTimeout(resolve, 4000));

      updateStepStatus('approval', 'completed');

      // Move to period selection step
      setTimeout(() => {
        updateStepStatus('period-selection', 'in-progress');
        setCurrentStep('period-selection');
      }, 1000);

    } catch (error: any) {
      console.error('Approval failed:', error);
      updateStepStatus('approval', 'error');

      let errorMessage = 'Failed to approve NFTs';
      if (error?.message?.includes('User rejected')) {
        errorMessage = 'Approval was cancelled by user';
      } else if (error?.message?.includes('insufficient funds')) {
        errorMessage = 'Insufficient funds for gas fees';
      } else {
        errorMessage = parseContractError(error) || error?.message?.slice(0, 100) || 'Failed to approve NFTs';
      }

      setError(errorMessage);
    }
  };

  const handleStaking = async () => {
    if (selectedPeriod === null) {
      setError('No lock period selected');
      return;
    }

    try {
      setError(null);
      updateStepStatus('staking', 'in-progress');
      setCurrentStep('staking');

      const tokenIds = selectedTokens.map(id => BigInt(id));

      const hash = await writeContractAsync({
        address: stakingContractAddress as `0x${string}`,
        abi: staking_abi,
        functionName: 'stakeBatch',
        args: [tokenIds, selectedPeriod],
      });

      setTransactionHashes(prev => ({ ...prev, staking: hash }));

      // Wait longer for staking transaction to be mined
      await new Promise(resolve => setTimeout(resolve, 4000));

      updateStepStatus('staking', 'completed');

      // Success - call parent success handler
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1500);

    } catch (error: any) {
      console.error('Staking failed:', error);
      updateStepStatus('staking', 'error');

      let errorMessage = 'Failed to stake tokens';
      if (error?.message?.includes('User rejected')) {
        errorMessage = 'Staking was cancelled by user';
      } else if (error?.message?.includes('insufficient funds')) {
        errorMessage = 'Insufficient funds for gas fees';
      } else {
        errorMessage = parseContractError(error) || error?.message?.slice(0, 100) || 'Failed to stake tokens';
      }

      setError(errorMessage);
    }
  };

  const handlePeriodSelection = (period: LockPeriod) => {
    setSelectedPeriod(period);
  };

  const handleConfirmPeriod = () => {
    if (selectedPeriod === null) return;

    setHasConfirmedPeriod(true);
    updateStepStatus('period-selection', 'completed');

    // Move to staking step
    setTimeout(() => {
      handleStaking();
    }, 500);
  };

  const lockPeriodOptions = [
    {
      period: LockPeriod.DAY,
      label: '1 Day',
      description: 'Lock for 24 hours',
      points: 7,
      icon: Clock,
      color: 'blue'
    },
    {
      period: LockPeriod.WEEK,
      label: '1 Week',
      description: 'Lock for 7 days',
      points: 10,
      icon: Calendar,
      color: 'purple'
    },
    {
      period: LockPeriod.MONTH,
      label: '1 Month',
      description: 'Lock for 30 days',
      points: 20,
      icon: CalendarDays,
      color: 'green'
    }
  ];

  const getStepIcon = (step: Step) => {
    switch (step.status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'in-progress':
        return <Loader2 className="w-5 h-5 animate-spin text-blue-500" />;
      case 'error':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      default:
        if (step.id === 'approval') return <Shield className="w-5 h-5 text-gray-400" />;
        if (step.id === 'period-selection') return <Clock className="w-5 h-5 text-gray-400" />;
        return <Lock className="w-5 h-5 text-gray-400" />;
    }
  };


  const canProceed = () => {
    const approvalStep = steps.find(s => s.id === 'approval');
    return approvalStep?.status === 'pending' || approvalStep?.status === 'error';
  };

  const isStakingReady = () => {
    const approvalStep = steps.find(s => s.id === 'approval');
    const stakingStep = steps.find(s => s.id === 'staking');
    return approvalStep?.status === 'completed' && stakingStep?.status === 'error';
  };

  const isProcessing = () => {
    return steps.some(step => step.status === 'in-progress');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`relative w-full max-w-md rounded-2xl shadow-2xl ${
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
                Stake NFTs
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
            disabled={isProcessing()}
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
          {/* Steps */}
          <div className="space-y-4">
            {steps.map((step, index) => (
              <div key={step.id} className={`rounded-xl border ${
                step.status === 'in-progress'
                  ? (isDarkMode ? 'bg-blue-900/20 border-blue-700' : 'bg-blue-50 border-blue-200')
                  : step.status === 'completed'
                  ? (isDarkMode ? 'bg-green-900/20 border-green-700' : 'bg-green-50 border-green-200')
                  : step.status === 'error'
                  ? (isDarkMode ? 'bg-red-900/20 border-red-700' : 'bg-red-50 border-red-200')
                  : (isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200')
              }`}>
                {/* Step Header */}
                <div className="flex items-start space-x-4 p-4">
                  <div className="flex-shrink-0 mt-0.5">
                    {getStepIcon(step)}
                  </div>
                  <div className="flex-grow min-w-0">
                    <h4 className={`font-medium ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                      Step {index + 1}: {step.title}
                    </h4>
                    <p className={`text-sm mt-1 ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      {step.description}
                    </p>
                    {step.status === 'in-progress' && step.id === 'approval' && (
                      <p className={`text-xs mt-2 ${
                        isDarkMode ? 'text-blue-400' : 'text-blue-600'
                      }`}>
                        Processing... Please check your wallet
                      </p>
                    )}
                    {step.status === 'in-progress' && step.id === 'staking' && (
                      <p className={`text-xs mt-2 ${
                        isDarkMode ? 'text-blue-400' : 'text-blue-600'
                      }`}>
                        Processing staking transaction...
                      </p>
                    )}
                    {transactionHashes[step.id as keyof typeof transactionHashes] && (
                      <p className={`text-xs mt-2 ${
                        isDarkMode ? 'text-gray-500' : 'text-gray-500'
                      }`}>
                        Tx: {transactionHashes[step.id as keyof typeof transactionHashes]?.slice(0, 10)}...{transactionHashes[step.id as keyof typeof transactionHashes]?.slice(-8)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Period Selection Content - Integrated in Step 2 */}
                {step.id === 'period-selection' && (
                  <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-600 mt-3">
                    <div className="pt-4 space-y-4">
                      {/* Period Options */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {lockPeriodOptions.map((option) => {
                          const isSelected = selectedPeriod === option.period;
                          const isEnabled = step.status === 'in-progress';
                          const IconComponent = option.icon;

                          return (
                            <button
                              key={option.period}
                              onClick={() => isEnabled ? handlePeriodSelection(option.period) : undefined}
                              disabled={!isEnabled}
                              className={`relative p-4 rounded-lg border-2 transition-all duration-200 text-center ${
                                !isEnabled
                                  ? (isDarkMode ? 'bg-gray-800 border-gray-600 opacity-40' : 'bg-gray-100 border-gray-300 opacity-40')
                                  : isSelected
                                  ? (isDarkMode ? 'bg-blue-900/40 border-blue-500 shadow-lg' : 'bg-blue-50 border-blue-500 shadow-lg')
                                  : (isDarkMode ? 'bg-gray-700 border-gray-500 hover:border-blue-400' : 'bg-white border-gray-200 hover:border-blue-300')
                              } ${isEnabled ? 'cursor-pointer hover:scale-105' : 'cursor-not-allowed'}`}
                            >
                              <div className="flex items-start justify-between w-full">
                                <div className="flex flex-col items-center flex-1">
                                  <div className={`w-8 h-8 rounded-lg mb-2 flex items-center justify-center ${
                                    !isEnabled
                                      ? (isDarkMode ? 'bg-gray-700' : 'bg-gray-200')
                                      : (isDarkMode ? 'bg-gray-600' : 'bg-gray-100')
                                  }`}>
                                    <IconComponent className={`w-4 h-4 ${
                                      !isEnabled
                                        ? 'text-gray-500'
                                        : isSelected
                                        ? 'text-blue-500'
                                        : (isDarkMode ? 'text-gray-400' : 'text-gray-500')
                                    }`} />
                                  </div>
                                  <h5 className={`font-semibold text-sm mb-1 text-center ${
                                    !isEnabled
                                      ? 'text-gray-500'
                                      : (isDarkMode ? 'text-white' : 'text-gray-900')
                                  }`}>
                                    {option.label}
                                  </h5>
                                  <p className={`text-xs text-center ${
                                    !isEnabled
                                      ? 'text-gray-500'
                                      : (isDarkMode ? 'text-gray-400' : 'text-gray-600')
                                  }`}>
                                    {option.description}
                                  </p>
                                </div>
                                <div className="flex flex-col items-end ml-2">
                                  <div className={`text-right ${
                                    !isEnabled
                                      ? 'text-gray-500'
                                      : isSelected
                                      ? 'text-blue-500'
                                      : (isDarkMode ? 'text-gray-400' : 'text-gray-600')
                                  }`}>
                                    <div className="flex items-center space-x-1">
                                      <Star className={`w-3 h-3 ${
                                        !isEnabled
                                          ? 'text-gray-500'
                                          : isSelected
                                          ? 'text-blue-500'
                                          : (isDarkMode ? 'text-gray-400' : 'text-gray-600')
                                      }`} />
                                      <span className="text-lg font-bold">{option.points}</span>
                                    </div>
                                    <div className="text-xs leading-tight">pts/day</div>
                                  </div>
                                </div>
                              </div>
                              {isSelected && isEnabled && (
                                <div className="absolute top-2 right-2">
                                  <CheckCircle className="w-4 h-4 text-blue-500" />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Confirm Button for Period Selection */}
                      {step.status === 'in-progress' && selectedPeriod !== null && (
                        <div className="flex justify-center pt-2">
                          <button
                            onClick={handleConfirmPeriod}
                            className="px-6 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white font-medium rounded-lg hover:from-green-600 hover:to-green-700 transition-colors"
                          >
                            Confirm {StakingService.getLockPeriodLabel(selectedPeriod)}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>


          {/* Error Message */}
          {error && (
            <div className={`p-4 rounded-xl border ${
              isDarkMode ? 'bg-red-900/20 border-red-700' : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <p className={`text-sm font-medium ${
                  isDarkMode ? 'text-red-400' : 'text-red-800'
                }`}>
                  {error}
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              disabled={isProcessing()}
              className={`flex-1 px-4 py-3 rounded-xl font-medium transition-colors ${
                isDarkMode
                  ? 'bg-gray-700 text-white hover:bg-gray-600 disabled:opacity-50'
                  : 'bg-gray-200 text-gray-900 hover:bg-gray-300 disabled:opacity-50'
              } disabled:cursor-not-allowed`}
            >
              {isProcessing() ? 'Processing...' : 'Cancel'}
            </button>

            {canProceed() && (
              <button
                onClick={handleApproval}
                disabled={isProcessing()}
                className={`flex-1 px-4 py-3 rounded-xl font-medium transition-colors ${
                  isProcessing()
                    ? 'bg-gray-400 text-white cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700'
                } disabled:opacity-50`}
              >
                {isProcessing() ? (
                  <div className="flex items-center justify-center space-x-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing...</span>
                  </div>
                ) : (
                  'Approve & Stake'
                )}
              </button>
            )}

            {isStakingReady() && (
              <button
                onClick={handleStaking}
                disabled={isProcessing()}
                className={`flex-1 px-4 py-3 rounded-xl font-medium transition-colors ${
                  isProcessing()
                    ? 'bg-gray-400 text-white cursor-not-allowed'
                    : 'bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700'
                } disabled:opacity-50`}
              >
                {isProcessing() ? (
                  <div className="flex items-center justify-center space-x-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Staking...</span>
                  </div>
                ) : (
                  'Retry Staking'
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}