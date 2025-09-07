'use client';

import { useState, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Loader2, Clock, ArrowRight } from 'lucide-react';
import { useAdminRaffleDeployment, type DeploymentStep, type RaffleDeploymentData } from '@/hooks/useAdminRaffleDeployment';
import { RaffleContractService } from '@/lib/raffle-contract';

interface RaffleDeploymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  raffle: any; // Raffle from database
  isDarkMode?: boolean;
  onSuccess?: () => void;
}

export default function RaffleDeploymentModal({ 
  isOpen, 
  onClose, 
  raffle, 
  isDarkMode = false, 
  onSuccess 
}: RaffleDeploymentModalProps) {
  const [deploymentData, setDeploymentData] = useState<RaffleDeploymentData | null>(null);
  
  const {
    steps,
    currentStep,
    isDeploying,
    deploymentComplete,
    deploymentError,
    initializeSteps,
    deployRaffleToBlockchain,
    resetDeployment
  } = useAdminRaffleDeployment();

  // Initialize deployment data when modal opens
  useEffect(() => {
    if (isOpen && raffle) {
      const data: RaffleDeploymentData = {
        raffleId: RaffleContractService.generateRaffleId(raffle.id),
        prizeTokenAddress: raffle.prize_token_address,
        prizeTokenType: raffle.prize_token_type,
        prizeTokenId: raffle.prize_token_id,
        prizeAmount: raffle.prize_amount,
        endTimestamp: RaffleContractService.dateToTimestamp(raffle.end_date)
      };
      
      setDeploymentData(data);
      initializeSteps(data);
    }
  }, [isOpen, raffle]);

  // Handle deployment completion
  useEffect(() => {
    if (deploymentComplete) {
      setTimeout(() => {
        if (onSuccess) {
          onSuccess();
        }
        onClose();
      }, 2000);
    }
  }, [deploymentComplete]);

  const handleStartDeployment = async () => {
    if (!deploymentData) return;
    
    const result = await deployRaffleToBlockchain(deploymentData);
    
    if (!result.success && result.error) {
      console.error('Deployment failed:', result.error);
    }
  };

  const handleClose = () => {
    if (!isDeploying) {
      resetDeployment();
      onClose();
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isDeploying) {
      handleClose();
    }
  };

  const getStepIcon = (step: DeploymentStep) => {
    switch (step.status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'in_progress':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  if (!isOpen || !raffle) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className={`max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl relative ${
        isDarkMode 
          ? 'bg-gray-800 border-gray-700' 
          : 'bg-white border-gray-200'
      } border`}>
        
        {/* Modal Header */}
        <div className={`p-6 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
          <div className="flex items-start justify-between">
            <div className="flex-1 mr-4">
              <h2 className={`text-xl font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Deploy Raffle to Blockchain
              </h2>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                {raffle.title}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className={`text-xs px-2 py-1 rounded-full ${
                  isDarkMode 
                    ? 'bg-purple-900/50 text-purple-300 border border-purple-800'
                    : 'bg-purple-100 text-purple-700 border border-purple-200'
                }`}>
                  Prize: {raffle.prize_token_type} • ID: {raffle.id}
                </span>
              </div>
            </div>
            <button
              onClick={handleClose}
              disabled={isDeploying}
              className={`p-2 rounded-lg transition-colors duration-200 ${
                isDeploying
                  ? 'opacity-50 cursor-not-allowed'
                  : isDarkMode 
                    ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-300' 
                    : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6">
          
          {/* Deployment Steps */}
          <div className="space-y-4">
            <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Deployment Steps
            </h3>
            
            <div className="space-y-3">
              {steps.map((step, index) => (
                <div key={step.id} className={`flex items-start space-x-3 p-4 rounded-xl border ${
                  step.status === 'completed' 
                    ? isDarkMode
                      ? 'bg-green-900/20 border-green-800'
                      : 'bg-green-50 border-green-200'
                    : step.status === 'failed'
                      ? isDarkMode
                        ? 'bg-red-900/20 border-red-800'
                        : 'bg-red-50 border-red-200'
                      : step.status === 'in_progress'
                        ? isDarkMode
                          ? 'bg-blue-900/20 border-blue-800'
                          : 'bg-blue-50 border-blue-200'
                        : isDarkMode
                          ? 'bg-gray-700/50 border-gray-600'
                          : 'bg-gray-50 border-gray-200'
                }`}>
                  
                  {/* Step Icon */}
                  <div className="flex-shrink-0">
                    {getStepIcon(step)}
                  </div>
                  
                  {/* Step Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className={`text-sm font-semibold ${
                        step.status === 'completed'
                          ? 'text-green-700'
                          : step.status === 'failed'
                            ? 'text-red-700'
                            : step.status === 'in_progress'
                              ? 'text-blue-700'
                              : isDarkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        {step.name}
                      </h4>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        step.status === 'completed'
                          ? 'bg-green-100 text-green-700'
                          : step.status === 'failed'
                            ? 'bg-red-100 text-red-700'
                            : step.status === 'in_progress'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-600'
                      }`}>
                        {step.status === 'in_progress' ? 'Processing...' : step.status}
                      </span>
                    </div>
                    <p className={`text-xs mt-1 ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      {step.description}
                    </p>
                    
                    {/* Transaction Hash */}
                    {step.txHash && (
                      <div className="mt-2">
                        <span className={`text-xs font-mono ${
                          isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          TX: {step.txHash.substring(0, 10)}...{step.txHash.substring(step.txHash.length - 8)}
                        </span>
                      </div>
                    )}
                    
                    {/* Error Message */}
                    {step.error && (
                      <div className="mt-2">
                        <p className="text-xs text-red-600 bg-red-100 px-2 py-1 rounded">
                          {step.error}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  {/* Arrow to next step */}
                  {index < steps.length - 1 && (
                    <div className="flex-shrink-0">
                      <ArrowRight className={`w-4 h-4 ${
                        isDarkMode ? 'text-gray-600' : 'text-gray-400'
                      }`} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Global Error Display */}
          {deploymentError && (
            <div className={`mt-6 p-4 rounded-xl border ${
              isDarkMode 
                ? 'bg-red-900/20 border-red-800 text-red-300' 
                : 'bg-red-50 border-red-200 text-red-700'
            }`}>
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-sm">Deployment Failed</h4>
                  <p className="text-xs mt-1">{deploymentError}</p>
                </div>
              </div>
            </div>
          )}

          {/* Success Message */}
          {deploymentComplete && (
            <div className={`mt-6 p-4 rounded-xl border ${
              isDarkMode 
                ? 'bg-green-900/20 border-green-800 text-green-300' 
                : 'bg-green-50 border-green-200 text-green-700'
            }`}>
              <div className="flex items-center space-x-3">
                <CheckCircle className="w-5 h-5 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-sm">Deployment Successful!</h4>
                  <p className="text-xs mt-1">Your raffle is now live on the blockchain and accepting entries.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className={`p-6 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
          <div className="flex items-center justify-end space-x-3">
            <button
              onClick={handleClose}
              disabled={isDeploying}
              className={`px-6 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                isDeploying
                  ? 'opacity-50 cursor-not-allowed'
                  : isDarkMode 
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {deploymentComplete ? 'Close' : 'Cancel'}
            </button>
            
            {!deploymentComplete && !deploymentError && (
              <button
                onClick={handleStartDeployment}
                disabled={isDeploying || steps.length === 0}
                className={`px-6 py-2 rounded-lg font-medium text-sm transition-all duration-200 flex items-center justify-center min-w-[140px] ${
                  isDeploying || steps.length === 0
                    ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                    : 'bg-purple-600 text-white hover:bg-purple-700 hover:shadow-md active:scale-95'
                }`}
              >
                {isDeploying ? (
                  <div className="flex items-center space-x-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Deploying...</span>
                  </div>
                ) : (
                  'Start Deployment'
                )}
              </button>
            )}

            {deploymentError && !isDeploying && (
              <button
                onClick={handleStartDeployment}
                className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium text-sm transition-all duration-200"
              >
                Retry Deployment
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}