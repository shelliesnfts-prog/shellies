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

function formatCooldown(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours} hour${hours !== 1 ? 's' : ''}`;
  if (minutes > 0) return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  return `${seconds} seconds`;
}

function InlineCountdownButton({
  secondsRemaining,
  onCountdownComplete,
  isDarkMode,
}: {
  secondsRemaining: number;
  onCountdownComplete: () => void;
  isDarkMode?: boolean;
}) {
  const [timeLeft, setTimeLeft] = useState(secondsRemaining);

  useEffect(() => {
    setTimeLeft(secondsRemaining);
  }, [secondsRemaining]);

  useEffect(() => {
    if (timeLeft <= 0) {
      onCountdownComplete();
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { onCountdownComplete(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, onCountdownComplete]);

  const h = Math.floor(timeLeft / 3600);
  const m = Math.floor((timeLeft % 3600) / 60);
  const s = timeLeft % 60;
  const formatted = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

  return (
    <button
      disabled
      className={`w-full px-4 py-3 rounded-xl font-medium cursor-not-allowed flex items-center justify-between ${
        isDarkMode ? 'bg-gray-700/50 text-gray-400' : 'bg-gray-100 text-gray-500'
      }`}
    >
      <span className="text-xs">Available in</span>
      <span className={`font-mono text-sm font-semibold tracking-wide ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}>
        {formatted}
      </span>
    </button>
  );
}

interface ClaimButtonWithCountdownProps {
  canClaim: boolean;
  secondsUntilNextClaim: number;
  nftCount: number;
  potentialPoints: number;
  onClaim: () => Promise<void>;
  claiming: boolean;
  claimCooldownSeconds?: number;
  isDarkMode?: boolean;
  isLoading?: boolean;
}

export function ClaimButtonWithCountdown({
  canClaim,
  secondsUntilNextClaim,
  nftCount,
  potentialPoints,
  onClaim,
  claiming,
  claimCooldownSeconds,
  isDarkMode,
  isLoading,
}: ClaimButtonWithCountdownProps) {
  const [localCanClaim, setLocalCanClaim] = useState(canClaim);
  const [localSecondsRemaining, setLocalSecondsRemaining] = useState(secondsUntilNextClaim);

  useEffect(() => {
    // Don't update local state while the chain data is still loading (wallet switch in progress)
    if (isLoading) return;
    setLocalCanClaim(canClaim);
    setLocalSecondsRemaining(secondsUntilNextClaim);
  }, [canClaim, secondsUntilNextClaim, isLoading]);

  const handleCountdownComplete = () => {
    setLocalCanClaim(true);
    setLocalSecondsRemaining(0);
  };

  const formatPoints = (points: number): string => {
    return points.toFixed(1);
  };

  return (
    <div className="space-y-2">
      {isLoading ? (
        <button
          disabled
          className={`w-full px-4 py-3 rounded-xl font-medium cursor-not-allowed flex items-center justify-center gap-2 ${
            isDarkMode ? 'bg-gray-700/50 text-gray-500' : 'bg-gray-100 text-gray-400'
          }`}
        >
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
          <span className="text-sm">Loading...</span>
        </button>
      ) : localCanClaim ? (
        <button
          onClick={onClaim}
          disabled={claiming}
          className={`w-full px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
            claiming
              ? `cursor-not-allowed ${isDarkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-400'}`
              : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-sm hover:shadow-md hover:shadow-green-500/20'
          }`}
        >
          {claiming ? (
            <div className="flex items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
              <span className="text-sm">Claiming...</span>
            </div>
          ) : (
            <span className="text-sm font-semibold">Claim {formatPoints(potentialPoints)} Points</span>
          )}
        </button>
      ) : (
        <InlineCountdownButton
          secondsRemaining={localSecondsRemaining}
          onCountdownComplete={handleCountdownComplete}
          isDarkMode={isDarkMode}
        />
      )}

      <p className={`text-[11px] text-center ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`}>
        {claimCooldownSeconds != null
          ? `Refreshes every ${formatCooldown(claimCooldownSeconds)}`
          : 'Refreshes every 24 hours'}
      </p>
    </div>
  );
}