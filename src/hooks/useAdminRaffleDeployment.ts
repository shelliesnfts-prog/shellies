'use client';

import { useState } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatEther } from 'viem';
import { RaffleContractService } from '@/lib/raffle-contract';
import { parseContractError } from '@/lib/errors';

export interface DeploymentStep {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  txHash?: string;
  error?: string;
}

export interface RaffleDeploymentData {
  raffleId: number;
  prizeTokenAddress: string;
  prizeTokenType: 'NFT' | 'ERC20';
  prizeTokenId?: string;
  prizeAmount?: string;
}

export function useAdminRaffleDeployment() {
  const [steps, setSteps] = useState<DeploymentStep[]>([]);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentComplete, setDeploymentComplete] = useState(false);
  const [deploymentError, setDeploymentError] = useState<string | null>(null);

  const { writeContractAsync } = useWriteContract();

  const initializeSteps = (deploymentData: RaffleDeploymentData) => {
    // Convert wei amount to human readable format for display
    const formatTokenAmount = (weiAmount: string) => {
      try {
        const formatted = formatEther(BigInt(weiAmount));
        // Remove unnecessary trailing zeros
        return parseFloat(formatted).toString();
      } catch (error) {
        console.error('Error formatting token amount:', error);
        return weiAmount;
      }
    };

    const baseSteps: DeploymentStep[] = [
      {
        id: 'approve',
        name: deploymentData.prizeTokenType === 'NFT' ? 'Approve NFT' : 'Approve Token',
        description: deploymentData.prizeTokenType === 'NFT'
          ? `Approve NFT #${deploymentData.prizeTokenId} for transfer`
          : `Reset and approve ${formatTokenAmount(deploymentData.prizeAmount || '0')} tokens for transfer`,
        status: 'pending'
      },
      {
        id: 'create',
        name: 'Create & Activate Raffle',
        description: 'Deploy and activate raffle on blockchain in one step',
        status: 'pending'
      },
      {
        id: 'activate',
        name: 'Activation Complete',
        description: 'Raffle is now active and accepting entries',
        status: 'pending'
      },
      {
        id: 'update_db',
        name: 'Update Database',
        description: 'Mark raffle as active in database',
        status: 'pending'
      }
    ];

    setSteps(baseSteps);
    setCurrentStep(null);
    setIsDeploying(false);
    setDeploymentComplete(false);
    setDeploymentError(null);
  };

  const updateStepStatus = (stepId: string, status: DeploymentStep['status'], txHash?: string, error?: string) => {
    setSteps(prevSteps => prevSteps.map(step => 
      step.id === stepId 
        ? { ...step, status, txHash, error }
        : step
    ));
  };

  const deployRaffleToBlockchain = async (deploymentData: RaffleDeploymentData) => {
    setIsDeploying(true);
    setDeploymentError(null);
    
    try {
      // Step 1: Approve prize token
      setCurrentStep('approve');
      updateStepStatus('approve', 'in_progress');

      let approveResult;
      if (deploymentData.prizeTokenType === 'NFT' && deploymentData.prizeTokenId) {
        approveResult = await RaffleContractService.adminApproveNFT(
          deploymentData.prizeTokenAddress,
          deploymentData.prizeTokenId,
          writeContractAsync
        );
      } else if (deploymentData.prizeTokenType === 'ERC20' && deploymentData.prizeAmount) {
        approveResult = await RaffleContractService.adminApproveERC20(
          deploymentData.prizeTokenAddress,
          deploymentData.prizeAmount,
          writeContractAsync
        );
      } else {
        throw new Error('Invalid prize configuration');
      }

      if (!approveResult.success) {
        updateStepStatus('approve', 'failed', undefined, approveResult.error);
        throw new Error(approveResult.error || 'Failed to approve token');
      }

      updateStepStatus('approve', 'completed', approveResult.txHash);

      // Step 2: Create raffle on blockchain
      setCurrentStep('create');
      updateStepStatus('create', 'in_progress');

      let createResult;
      if (deploymentData.prizeTokenType === 'NFT' && deploymentData.prizeTokenId) {
        createResult = await RaffleContractService.adminCreateRaffleWithNFT(
          deploymentData.raffleId,
          deploymentData.prizeTokenAddress,
          deploymentData.prizeTokenId,
          writeContractAsync
        );
      } else if (deploymentData.prizeTokenType === 'ERC20' && deploymentData.prizeAmount) {
        createResult = await RaffleContractService.adminCreateRaffleWithToken(
          deploymentData.raffleId,
          deploymentData.prizeTokenAddress,
          deploymentData.prizeAmount,
          writeContractAsync
        );
      } else {
        throw new Error('Invalid prize configuration');
      }

      if (!createResult.success) {
        updateStepStatus('create', 'failed', undefined, createResult.error);
        throw new Error(createResult.error || 'Failed to create raffle');
      }

      updateStepStatus('create', 'completed', createResult.txHash);

      // Step 3: Skip activation since createAndActivateNFTRaffle does both
      updateStepStatus('activate', 'completed');

      // Step 4: Update database
      setCurrentStep('update_db');
      updateStepStatus('update_db', 'in_progress');

      const updateResponse = await fetch('/api/admin/raffles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mark_blockchain_deployed',
          raffleId: deploymentData.raffleId,
          txHashes: [approveResult.txHash, createResult.txHash]
        })
      });

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json();
        updateStepStatus('update_db', 'failed', undefined, errorData.error);
        throw new Error(errorData.error || 'Failed to update database');
      }

      updateStepStatus('update_db', 'completed');

      setDeploymentComplete(true);
      setCurrentStep(null);
      
      return {
        success: true,
        txHashes: [approveResult.txHash, createResult.txHash]
      };

    } catch (error) {
      console.error('Deployment error:', error);
      
      const errorMessage = parseContractError(error);
      setDeploymentError(errorMessage);

      // Mark raffle as failed in database
      try {
        const response = await fetch('/api/admin/raffles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'mark_blockchain_failed',
            raffleId: deploymentData.raffleId,
            blockchainError: errorMessage,
            shouldDelete: false // Keep for retry
          })
        });
        
        if (response.ok) {
        } else {
          console.error('Failed to mark raffle as failed:', await response.text());
        }
      } catch (dbError) {
        console.error('Failed to mark raffle as failed:', dbError);
      }

      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setIsDeploying(false);
    }
  };

  const resetDeployment = () => {
    setSteps([]);
    setCurrentStep(null);
    setIsDeploying(false);
    setDeploymentComplete(false);
    setDeploymentError(null);
  };

  return {
    steps,
    currentStep,
    isDeploying,
    deploymentComplete,
    deploymentError,
    initializeSteps,
    deployRaffleToBlockchain,
    resetDeployment
  };
}