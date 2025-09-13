'use client';

import { useState } from 'react';
import { useWriteContract } from 'wagmi';
import { X, Shield, Lock, Loader2, CheckCircle, AlertTriangle, Star, Trophy } from 'lucide-react';
import { erc721Abi } from 'viem';
import { staking_abi } from '@/lib/staking-abi';
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
  id: 'approval' | 'staking';
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
      id: 'staking',
      title: 'Stake NFTs',
      description: 'Lock your NFTs to start earning points',
      status: 'pending'
    }
  ]);

  const [currentStep, setCurrentStep] = useState<'approval' | 'staking'>('approval');
  const [transactionHashes, setTransactionHashes] = useState<{ approval?: string; staking?: string }>({});
  const [error, setError] = useState<string | null>(null);

  const { writeContractAsync } = useWriteContract();

  const updateStepStatus = (stepId: 'approval' | 'staking', status: StepStatus) => {
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

      // Wait additional time to ensure approval is confirmed on-chain before staking
      setTimeout(() => {
        handleStaking();
      }, 2000);

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
    try {
      setError(null);
      updateStepStatus('staking', 'in-progress');
      setCurrentStep('staking');

      const tokenIds = selectedTokens.map(id => BigInt(id));

      const hash = await writeContractAsync({
        address: stakingContractAddress as `0x${string}`,
        abi: staking_abi,
        functionName: 'stakeBatch',
        args: [tokenIds],
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

  const getStepIcon = (step: Step) => {
    switch (step.status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'in-progress':
        return <Loader2 className="w-5 h-5 animate-spin text-blue-500" />;
      case 'error':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      default:
        return step.id === 'approval' ?
          <Shield className="w-5 h-5 text-gray-400" /> :
          <Lock className="w-5 h-5 text-gray-400" />;
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
              <div key={step.id} className={`flex items-start space-x-4 p-4 rounded-xl border ${
                step.status === 'in-progress'
                  ? (isDarkMode ? 'bg-blue-900/20 border-blue-700' : 'bg-blue-50 border-blue-200')
                  : step.status === 'completed'
                  ? (isDarkMode ? 'bg-green-900/20 border-green-700' : 'bg-green-50 border-green-200')
                  : step.status === 'error'
                  ? (isDarkMode ? 'bg-red-900/20 border-red-700' : 'bg-red-50 border-red-200')
                  : (isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200')
              }`}>
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
                  {step.status === 'in-progress' && (
                    <p className={`text-xs mt-2 ${
                      isDarkMode ? 'text-blue-400' : 'text-blue-600'
                    }`}>
                      Processing... Please check your wallet
                    </p>
                  )}
                  {transactionHashes[step.id] && (
                    <p className={`text-xs mt-2 ${
                      isDarkMode ? 'text-gray-500' : 'text-gray-500'
                    }`}>
                      Tx: {transactionHashes[step.id]?.slice(0, 10)}...{transactionHashes[step.id]?.slice(-8)}
                    </p>
                  )}
                </div>
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