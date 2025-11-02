/**
 * Formatting utilities for displaying game metrics
 */

/**
 * Format XP (game score) with locale formatting and "XP" suffix
 * @param score - The XP value to format
 * @returns Formatted string like "1,250 XP"
 */
export function formatXP(score: number): string {
  return `${score.toLocaleString()} XP`;
}

/**
 * Format points with locale formatting and "points" suffix
 * @param points - The points value to format
 * @returns Formatted string like "1,250 points"
 */
export function formatPoints(points: number): string {
  return `${points.toLocaleString()} points`;
}
