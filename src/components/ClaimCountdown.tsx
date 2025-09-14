'use client';

import { useState, useEffect } from 'react';

interface ClaimCountdownProps {
  secondsRemaining: number;
  onCountdownComplete?: () => void;
}

export function ClaimCountdown({ secondsRemaining, onCountdownComplete }: ClaimCountdownProps) {
  const [timeLeft, setTimeLeft] = useState(secondsRemaining);

  useEffect(() => {
    setTimeLeft(secondsRemaining);
  }, [secondsRemaining]);

  useEffect(() => {
    if (timeLeft <= 0) {
      onCountdownComplete?.();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          onCountdownComplete?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, onCountdownComplete]);

  if (timeLeft <= 0) {
    return (
      <div className="text-green-400 font-medium">
        ✅ Ready to claim!
      </div>
    );
  }

  // Convert seconds to hours, minutes, seconds
  const hours = Math.floor(timeLeft / 3600);
  const minutes = Math.floor((timeLeft % 3600) / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="text-center">
      <div className="text-gray-400 text-sm mb-2">Next claim available in:</div>
      <div className="font-mono text-lg font-bold text-purple-400">
        {String(hours).padStart(2, '0')}h {String(minutes).padStart(2, '0')}m {String(seconds).padStart(2, '0')}s
      </div>
    </div>
  );
}

interface ClaimButtonWithCountdownProps {
  canClaim: boolean;
  secondsUntilNextClaim: number;
  nftCount: number;
  potentialPoints: number;
  onClaim: () => Promise<void>;
  claiming: boolean;
}

export function ClaimButtonWithCountdown({
  canClaim,
  secondsUntilNextClaim,
  nftCount,
  potentialPoints,
  onClaim,
  claiming
}: ClaimButtonWithCountdownProps) {
  const [localCanClaim, setLocalCanClaim] = useState(canClaim);
  const [localSecondsRemaining, setLocalSecondsRemaining] = useState(secondsUntilNextClaim);

  useEffect(() => {
    setLocalCanClaim(canClaim);
    setLocalSecondsRemaining(secondsUntilNextClaim);
  }, [canClaim, secondsUntilNextClaim]);

  const handleCountdownComplete = () => {
    setLocalCanClaim(true);
    setLocalSecondsRemaining(0);
  };

  const formatPoints = (points: number): string => {
    // Always show 1 decimal place for consistency (e.g., "0.1", "1.0", "5.0")
    return points.toFixed(1);
  };

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 max-w-[30rem] mx-auto">
      {/* Claim Button or Countdown */}
      {localCanClaim ? (
        <button
          onClick={onClaim}
          disabled={claiming}
          className={`w-full px-4 py-3 rounded-lg font-medium transition-all duration-200 transform ${
            claiming
              ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
              : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white hover:scale-105 shadow-lg'
          }`}
        >
          {claiming ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              Claiming...
            </div>
          ) : (
            `Claim ${formatPoints(potentialPoints)} Points`
          )}
        </button>
      ) : (
        <div>
          <ClaimCountdown 
            secondsRemaining={localSecondsRemaining}
            onCountdownComplete={handleCountdownComplete}
          />
          <button
            disabled={true}
            className="w-full mt-3 bg-gray-600 text-gray-300 px-4 py-3 rounded-lg font-medium cursor-not-allowed"
          >
            Claim {formatPoints(potentialPoints)} Points
          </button>
        </div>
      )}
      
      <div className="text-xs text-gray-400 mt-3 text-center">
        Claims are available once every 24 hours
      </div>
    </div>
  );
}