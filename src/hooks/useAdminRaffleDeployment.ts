'use client';

import { useState } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
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
  prizeTokenId: string;
  pointsPerTicket: number;
}

export function useAdminRaffleDeployment() {
  const [steps, setSteps] = useState<DeploymentStep[]>([]);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentComplete, setDeploymentComplete] = useState(false);
  const [deploymentError, setDeploymentError] = useState<string | null>(null);
  const [nftHeld, setNftHeld] = useState<boolean | null>(null);
  const [nftCurrentOwner, setNftCurrentOwner] = useState<string | null>(null);

  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const buildSteps = (held: boolean): DeploymentStep[] => {
    const list: DeploymentStep[] = [];
    if (!held) {
      list.push({
        id: 'transfer',
        name: 'Transfer NFT to Raffle Contract',
        description: 'Send the prize NFT from your wallet into the raffle contract for escrow',
        status: 'pending',
      });
    }
    list.push(
      {
        id: 'create',
        name: 'Create & Activate Raffle',
        description: 'Register the held NFT as a new raffle and mark it active on-chain',
        status: 'pending',
      },
      {
        id: 'update_db',
        name: 'Update Database',
        description: 'Mark raffle as ACTIVE in the database',
        status: 'pending',
      }
    );
    return list;
  };

  const initializeSteps = async (deploymentData: RaffleDeploymentData) => {
    setCurrentStep(null);
    setIsDeploying(false);
    setDeploymentComplete(false);
    setDeploymentError(null);

    // Check ownership up-front so the step list reflects whether a transfer is needed
    const ownership = await RaffleContractService.checkNFTHeldByContract(
      deploymentData.prizeTokenAddress,
      deploymentData.prizeTokenId
    );
    setNftHeld(ownership.held);
    setNftCurrentOwner(ownership.currentOwner || null);
    setSteps(buildSteps(ownership.held));
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

    const txHashes: string[] = [];

    try {
      // Re-check ownership at deploy time in case the user transferred the NFT
      // out-of-band between modal-open and clicking Start.
      const ownership = await RaffleContractService.checkNFTHeldByContract(
        deploymentData.prizeTokenAddress,
        deploymentData.prizeTokenId
      );
      setNftHeld(ownership.held);
      setNftCurrentOwner(ownership.currentOwner || null);

      // Rebuild steps so transfer step is added/removed based on current ownership
      setSteps(buildSteps(ownership.held));

      // Step 1 (conditional): transfer NFT into the raffle contract
      if (!ownership.held) {
        if (!address) {
          throw new Error('No connected wallet — cannot transfer NFT');
        }
        if (
          ownership.currentOwner &&
          ownership.currentOwner.toLowerCase() !== address.toLowerCase()
        ) {
          throw new Error(
            `NFT #${deploymentData.prizeTokenId} is owned by ${ownership.currentOwner}, not your connected wallet. Transfer it from the owning wallet first.`
          );
        }

        setCurrentStep('transfer');
        updateStepStatus('transfer', 'in_progress');

        const transferResult = await RaffleContractService.adminTransferNFTToRaffle(
          deploymentData.prizeTokenAddress,
          deploymentData.prizeTokenId,
          address,
          writeContractAsync
        );

        if (!transferResult.success) {
          updateStepStatus('transfer', 'failed', undefined, transferResult.error);
          throw new Error(transferResult.error || 'Failed to transfer NFT to raffle contract');
        }

        updateStepStatus('transfer', 'completed', transferResult.txHash);
        if (transferResult.txHash) txHashes.push(transferResult.txHash);
      }

      // Step 2: create & activate raffle on the new contract
      setCurrentStep('create');
      updateStepStatus('create', 'in_progress');

      const createResult = await RaffleContractService.adminCreateRaffleWithHeldNFT(
        deploymentData.raffleId,
        deploymentData.prizeTokenAddress,
        deploymentData.prizeTokenId,
        deploymentData.pointsPerTicket,
        writeContractAsync
      );

      if (!createResult.success) {
        updateStepStatus('create', 'failed', undefined, createResult.error);
        throw new Error(createResult.error || 'Failed to create raffle');
      }

      updateStepStatus('create', 'completed', createResult.txHash);
      if (createResult.txHash) txHashes.push(createResult.txHash);

      // Step 3: mark raffle ACTIVE in the database
      setCurrentStep('update_db');
      updateStepStatus('update_db', 'in_progress');

      const updateResponse = await fetch('/api/admin/raffles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mark_blockchain_deployed',
          raffleId: deploymentData.raffleId,
          txHashes,
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

      return { success: true, txHashes };
    } catch (error) {
      console.error('Deployment error:', error);

      const errorMessage = parseContractError(error);
      setDeploymentError(errorMessage);

      try {
        await fetch('/api/admin/raffles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'mark_blockchain_failed',
            raffleId: deploymentData.raffleId,
            blockchainError: errorMessage,
            shouldDelete: false,
          })
        });
      } catch (dbError) {
        console.error('Failed to mark raffle as failed:', dbError);
      }

      return { success: false, error: errorMessage };
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
    setNftHeld(null);
    setNftCurrentOwner(null);
  };

  return {
    steps,
    currentStep,
    isDeploying,
    deploymentComplete,
    deploymentError,
    nftHeld,
    nftCurrentOwner,
    initializeSteps,
    deployRaffleToBlockchain,
    resetDeployment,
  };
}
