import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { GameLeaderboardEntry } from '@/lib/types';

interface UseGameScoreReturn {
  currentScore: number;
  bestScore: number;
  isLoading: boolean;
  error: string | null;
  updateScore: (newScore: number, immediate?: boolean) => Promise<boolean>;
  leaderboard: GameLeaderboardEntry[];
  loadLeaderboard: () => Promise<void>;
  resetLocalScore: () => void;
  flushPendingScore: () => Promise<void>;
  hasPendingScore: boolean;
}

const STORAGE_KEY = 'shellies_game_best_score';
const THROTTLE_DELAY = 5000; // 5 seconds

export function useGameScore(): UseGameScoreReturn {
  const { data: session } = useSession();
  const walletAddress = session?.address;

  const [currentScore, setCurrentScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<GameLeaderboardEntry[]>([]);
  const [hasPendingScore, setHasPendingScore] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingScoreRef = useRef<number | null>(null);

  // Set mounted state
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Load best score from localStorage
  const loadLocalScore = useCallback((): number => {
    if (typeof window === 'undefined' || !isMounted) return 0;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      return stored ? parseInt(stored, 10) : 0;
    } catch (err) {
      console.error('Error loading local score:', err);
      return 0;
    }
  }, [isMounted]);

  // Save best score to localStorage
  const saveLocalScore = useCallback((score: number) => {
    if (typeof window === 'undefined' || !isMounted) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, score.toString());
    } catch (err) {
      console.error('Error saving local score:', err);
    }
  }, [isMounted]);

  // Load best score from API
  const loadBestScore = useCallback(async () => {
    if (!walletAddress) {
      // If not connected, load from localStorage
      const localScore = loadLocalScore();
      setBestScore(localScore);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/game-score?walletAddress=${encodeURIComponent(walletAddress)}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch game score');
      }

      const data = await response.json();
      const score = data.game_score || 0;
      
      setBestScore(score);
      saveLocalScore(score);
    } catch (err) {
      console.error('Error loading best score:', err);
      setError(err instanceof Error ? err.message : 'Failed to load score');
      
      // Fallback to localStorage
      const localScore = loadLocalScore();
      setBestScore(localScore);
    } finally {
      setIsLoading(false);
    }
  }, [walletAddress, loadLocalScore, saveLocalScore]);

  // Update score to database
  const updateScoreToDatabase = useCallback(async (score: number): Promise<boolean> => {
    if (!walletAddress) {
      return false;
    }

    try {
      const response = await fetch('/api/game-score', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          score,
          walletAddress,
        }),
      });

      // Handle 403 Forbidden - payment session expired
      if (response.status === 403) {
        const errorData = await response.json();
        setError('PAYMENT_REQUIRED'); // Special error code
        
        // Dispatch custom event to trigger payment modal
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('paymentRequired', {
            detail: { 
              message: errorData.error || 'Payment required to submit score',
              score 
            }
          }));
        }
        
        return false;
      }

      if (!response.ok) {
        throw new Error('Failed to update game score');
      }

      const data = await response.json();
      
      if (data.success && data.isNewBest) {
        setBestScore(data.game_score);
        saveLocalScore(data.game_score);
      }

      return data.success;
    } catch (err) {
      console.error('Error updating score to database:', err);
      setError(err instanceof Error ? err.message : 'Failed to update score');
      return false;
    }
  }, [walletAddress, saveLocalScore]);

  // Update score with throttling
  const updateScore = useCallback(async (newScore: number, immediate = false): Promise<boolean> => {
    setCurrentScore(newScore);

    // Only update if it's a new best score
    if (newScore <= bestScore) {
      return false;
    }

    // Update localStorage immediately
    setBestScore(newScore);
    saveLocalScore(newScore);

    // If not connected, only save to localStorage
    if (!walletAddress) {
      return true;
    }

    // If immediate flag is set, update database right away
    if (immediate) {
      // Clear any pending timeout
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
        updateTimeoutRef.current = null;
      }
      pendingScoreRef.current = null;
      setHasPendingScore(false);
      
      return await updateScoreToDatabase(newScore);
    }

    // Otherwise, throttle the database update
    pendingScoreRef.current = newScore;
    setHasPendingScore(true);

    // Clear previous timeout
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    // Set new timeout
    updateTimeoutRef.current = setTimeout(async () => {
      if (pendingScoreRef.current !== null) {
        await updateScoreToDatabase(pendingScoreRef.current);
        pendingScoreRef.current = null;
        setHasPendingScore(false);
      }
      updateTimeoutRef.current = null;
    }, THROTTLE_DELAY);

    return true;
  }, [bestScore, walletAddress, saveLocalScore, updateScoreToDatabase]);

  // Flush pending score immediately
  const flushPendingScore = useCallback(async () => {
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
      updateTimeoutRef.current = null;
    }

    if (pendingScoreRef.current !== null && walletAddress) {
      await updateScoreToDatabase(pendingScoreRef.current);
      pendingScoreRef.current = null;
      setHasPendingScore(false);
    }
  }, [walletAddress, updateScoreToDatabase]);

  // Load leaderboard
  const loadLeaderboard = useCallback(async () => {
    try {
      const response = await fetch('/api/game-leaderboard');
      
      if (!response.ok) {
        throw new Error('Failed to fetch leaderboard');
      }

      const data = await response.json();
      setLeaderboard(data.leaderboard || []);
    } catch (err) {
      console.error('Error loading leaderboard:', err);
      setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
    }
  }, []);

  // Reset local score
  const resetLocalScore = useCallback(() => {
    if (typeof window === 'undefined' || !isMounted) return;
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      setBestScore(0);
      setCurrentScore(0);
    } catch (err) {
      console.error('Error resetting local score:', err);
    }
  }, [isMounted]);

  // Load best score when wallet address changes or component mounts
  useEffect(() => {
    if (isMounted) {
      loadBestScore();
    }
  }, [loadBestScore, isMounted]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  return {
    currentScore,
    bestScore,
    isLoading,
    error,
    updateScore,
    leaderboard,
    loadLeaderboard,
    resetLocalScore,
    flushPendingScore,
    hasPendingScore,
  };
}
