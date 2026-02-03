/**
 * Points System Constants
 * 
 * These constants define the maximum possible points that can be earned
 * in a single claim based on realistic user NFT holdings and point formulas.
 */

// Total NFT supply in the collection
export const TOTAL_NFT_SUPPLY = 2222;

// Realistic maximum NFTs per user (based on actual distribution)
// Average user has way less, but we set a reasonable upper limit
export const MAX_NFTS_PER_USER = 100;

// Points per NFT based on status
export const POINTS_PER_AVAILABLE_NFT = 5;
export const POINTS_PER_DAILY_STAKED_NFT = 7;
export const POINTS_PER_WEEKLY_STAKED_NFT = 10;
export const POINTS_PER_MONTHLY_STAKED_NFT = 20;
export const POINTS_FOR_REGULAR_USER = 1; // Users with 0 NFTs

/**
 * Calculate maximum realistic points per claim
 * 
 * Realistic maximum scenario: User owns 100 NFTs and stakes them all for 1 month
 * - Available NFTs: 0 (all staked)
 * - Monthly staked: 100 × 20 = 2,000 points
 * 
 * This is the realistic maximum based on actual user distribution.
 */
export const MAX_POINTS_PER_CLAIM = MAX_NFTS_PER_USER * POINTS_PER_MONTHLY_STAKED_NFT; // 2,000

/**
 * Maximum reasonable points for validation
 * Set slightly higher than realistic max to account for edge cases
 * (e.g., whale users with slightly more NFTs)
 */
export const MAX_REASONABLE_POINTS = MAX_POINTS_PER_CLAIM * 1.5; // 3,000 (50% buffer)

/**
 * Validation thresholds for suspicious activity
 */
export const SUSPICIOUS_POINTS_THRESHOLD = 1000; // Flag for review (50+ NFTs staked monthly)
export const CRITICAL_POINTS_THRESHOLD = MAX_POINTS_PER_CLAIM; // 2,000 points (definitely suspicious)

/**
 * Calculate expected points for a given NFT configuration
 */
export function calculateExpectedPoints(
  availableNFTs: number,
  dailyStaked: number,
  weeklyStaked: number,
  monthlyStaked: number
): number {
  const availablePoints = availableNFTs * POINTS_PER_AVAILABLE_NFT;
  const dailyPoints = dailyStaked * POINTS_PER_DAILY_STAKED_NFT;
  const weeklyPoints = weeklyStaked * POINTS_PER_WEEKLY_STAKED_NFT;
  const monthlyPoints = monthlyStaked * POINTS_PER_MONTHLY_STAKED_NFT;
  
  return availablePoints + dailyPoints + weeklyPoints + monthlyPoints;
}

/**
 * Validate if points amount is reasonable
 */
export function isValidPointsAmount(points: number): {
  isValid: boolean;
  reason?: string;
} {
  if (points < 0) {
    return { isValid: false, reason: 'Points cannot be negative' };
  }
  
  if (points === 0) {
    return { isValid: true };
  }
  
  if (points > MAX_REASONABLE_POINTS) {
    return { 
      isValid: false, 
      reason: `Points ${points} exceeds maximum possible ${MAX_REASONABLE_POINTS}` 
    };
  }
  
  return { isValid: true };
}

/**
 * Get risk level for a points amount
 */
export function getPointsRiskLevel(points: number): 'NORMAL' | 'SUSPICIOUS' | 'CRITICAL' {
  if (points >= CRITICAL_POINTS_THRESHOLD) {
    return 'CRITICAL';
  }
  
  if (points >= SUSPICIOUS_POINTS_THRESHOLD) {
    return 'SUSPICIOUS';
  }
  
  return 'NORMAL';
}
