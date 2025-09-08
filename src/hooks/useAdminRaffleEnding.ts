'use client';

import { useState } from 'react';
import { useWriteContract } from 'wagmi';
import { RaffleContractService } from '@/lib/raffle-contract';
import { parseContractError } from '@/lib/errors';

export interface EndingStep {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  txHash?: string;
  error?: string;
}

export interface RaffleEndingData {
  raffleId: string | number;
  participants?: any[];
  totalParticipants?: number;
  totalTickets?: number;
}

export function useAdminRaffleEnding() {
  const [steps, setSteps] = useState<EndingStep[]>([]);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [isEnding, setIsEnding] = useState(false);
  const [endingComplete, setEndingComplete] = useState(false);
  const [endingError, setEndingError] = useState<string | null>(null);

  const { writeContractAsync } = useWriteContract();

  const initializeSteps = (endingData: RaffleEndingData) => {
    const baseSteps: EndingStep[] = [
      {
        id: 'prepare',
        name: 'Prepare Ending Data',
        description: 'Fetch participants and prepare blockchain transaction',
        status: 'pending'
      },
      {
        id: 'execute',
        name: 'End Raffle on Blockchain',
        description: 'Execute smart contract endRaffle function with participants',
        status: 'pending'
      },
      {
        id: 'update_db',
        name: 'Update Database',
        description: 'Mark raffle as completed in database',
        status: 'pending'
      }
    ];

    setSteps(baseSteps);
    setCurrentStep(null);
    setIsEnding(false);
    setEndingComplete(false);
    setEndingError(null);
  };

  const updateStepStatus = (stepId: string, status: EndingStep['status'], txHash?: string, error?: string) => {
    setSteps(prevSteps => prevSteps.map(step => 
      step.id === stepId 
        ? { ...step, status, txHash, error }
        : step
    ));
  };

  const endRaffleOnBlockchain = async (endingData: RaffleEndingData) => {
    setIsEnding(true);
    setEndingError(null);
    
    try {
      // Step 1: Prepare ending data (fetch participants)
      setCurrentStep('prepare');
      updateStepStatus('prepare', 'in_progress');

      const prepareResponse = await fetch('/api/admin/raffles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'prepare_admin_end',
          raffleId: endingData.raffleId
        })
      });

      if (!prepareResponse.ok) {
        const errorData = await prepareResponse.json();
        updateStepStatus('prepare', 'failed', undefined, errorData.error);
        throw new Error(errorData.error || 'Failed to prepare ending data');
      }

      const prepareData = await prepareResponse.json();
      if (!prepareData.success) {
        updateStepStatus('prepare', 'failed', undefined, prepareData.error);
        throw new Error(prepareData.error || 'Failed to prepare ending data');
      }

      updateStepStatus('prepare', 'completed');

      // Step 2: Execute smart contract
      setCurrentStep('execute');
      updateStepStatus('execute', 'in_progress');

      const endResult = await RaffleContractService.adminEndRaffle(
        endingData.raffleId,
        writeContractAsync
      );

      if (!endResult.success) {
        updateStepStatus('execute', 'failed', undefined, endResult.error);
        throw new Error(endResult.error || 'Failed to end raffle on blockchain');
      }

      updateStepStatus('execute', 'completed', endResult.txHash);

      // Step 3: Update database
      setCurrentStep('update_db');
      updateStepStatus('update_db', 'in_progress');

      const updateResponse = await fetch('/api/admin/raffles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mark_raffle_ended',
          raffleId: endingData.raffleId,
          txHash: endResult.txHash
        })
      });

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json();
        updateStepStatus('update_db', 'failed', undefined, errorData.error);
        throw new Error(errorData.error || 'Failed to update database');
      }

      updateStepStatus('update_db', 'completed');

      setEndingComplete(true);
      setCurrentStep(null);
      
      return {
        success: true,
        txHash: endResult.txHash,
        participants: endResult.participants
      };

    } catch (error) {
      console.error('Raffle ending error:', error);
      
      const errorMessage = parseContractError(error);
      setEndingError(errorMessage);

      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setIsEnding(false);
    }
  };

  const resetEnding = () => {
    setSteps([]);
    setCurrentStep(null);
    setIsEnding(false);
    setEndingComplete(false);
    setEndingError(null);
  };

  return {
    steps,
    currentStep,
    isEnding,
    endingComplete,
    endingError,
    initializeSteps,
    endRaffleOnBlockchain,
    resetEnding
  };
}