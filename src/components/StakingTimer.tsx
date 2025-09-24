import { Lock } from 'lucide-react';
import { StakingService, LockPeriod } from '@/lib/staking-service';
import { useCountdown } from '@/hooks/useCountdown';

interface StakingTimerProps {
  lockPeriod: LockPeriod;
  initialTimeRemaining: number;
  canUnstake: boolean;
  isDarkMode?: boolean;
}

export function StakingTimer({
  lockPeriod,
  initialTimeRemaining,
  canUnstake: initialCanUnstake,
  isDarkMode = false
}: StakingTimerProps) {
  const currentTimeRemaining = useCountdown(initialTimeRemaining);
  const canUnstake = initialCanUnstake || currentTimeRemaining <= 0;

  return (
    <div className="text-xs text-center space-y-1">
      {/* Lock Period */}
      <div className={`font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
        {StakingService.getLockPeriodLabel(lockPeriod)}
      </div>

      {/* Timer with Lock Icon */}
      <div className="flex items-center justify-center gap-1">
        <Lock className={`w-3 h-3 ${canUnstake ? 'text-green-500' : 'text-orange-500'}`} />
        <div className={`font-medium ${
          canUnstake
            ? 'text-green-600'
            : 'text-orange-600'
        }`}>
          {StakingService.formatTimeRemaining(currentTimeRemaining)}
        </div>
      </div>
    </div>
  );
}