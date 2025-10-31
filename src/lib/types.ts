/**
 * Game Integration Type Definitions
 * 
 * This file contains TypeScript type definitions for the Shellies Game integration.
 * These types are used across the application for game-related functionality.
 */

/**
 * Interface for game score update requests
 * Used when updating a user's game score via the API
 */
export interface GameScoreUpdate {
  /** The new score to be saved */
  score: number;
  /** The wallet address of the user */
  walletAddress: string;
}

/**
 * Interface for game leaderboard entries
 * Represents a single entry in the game leaderboard
 */
export interface GameLeaderboardEntry {
  /** The wallet address of the user */
  wallet_address: string;
  /** The user's best game score */
  game_score: number;
  /** Optional username for display */
  username?: string;
  /** Optional avatar URL for display */
  avatar?: string;
  /** Optional rank position in the leaderboard */
  rank?: number;
}
