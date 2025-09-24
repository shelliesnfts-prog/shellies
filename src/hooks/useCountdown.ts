import { useState, useEffect, useRef } from 'react';

/**
 * Custom hook for countdown timer
 * @param initialTimeRemaining - Initial time remaining in seconds
 * @returns Current time remaining in seconds
 */
export function useCountdown(initialTimeRemaining: number): number {
  const [timeRemaining, setTimeRemaining] = useState(initialTimeRemaining);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Reset time when initial value changes
    setTimeRemaining(initialTimeRemaining);
  }, [initialTimeRemaining]);

  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Only start countdown if time remaining is greater than 0
    if (timeRemaining > 0) {
      intervalRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          const newTime = prev - 1;
          // Stop countdown when reaching 0
          if (newTime <= 0) {
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            return 0;
          }
          return newTime;
        });
      }, 1000);
    }

    // Cleanup interval on unmount or when dependencies change
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [timeRemaining]);

  return timeRemaining;
}