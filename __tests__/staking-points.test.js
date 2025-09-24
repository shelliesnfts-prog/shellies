/**
 * @jest-environment node
 */

// Test the StakingService points calculation logic
describe('Staking Points Calculation Tests', () => {
  // Mock the StakingService since we're testing the logic
  const StakingService = {
    calculateDailyPointsByPeriod: (breakdown) => {
      const dayPoints = breakdown.day * 7;    // 7 points per day-staked NFT
      const weekPoints = breakdown.week * 10; // 10 points per week-staked NFT
      const monthPoints = breakdown.month * 20; // 20 points per month-staked NFT

      return dayPoints + weekPoints + monthPoints;
    }
  };

  describe('Staking Period Points Calculation', () => {
    test('should calculate correct points for day staking only', () => {
      const breakdown = { day: 1, week: 0, month: 0 };
      const points = StakingService.calculateDailyPointsByPeriod(breakdown);
      expect(points).toBe(7); // 1 * 7 = 7
    });

    test('should calculate correct points for week staking only', () => {
      const breakdown = { day: 0, week: 1, month: 0 };
      const points = StakingService.calculateDailyPointsByPeriod(breakdown);
      expect(points).toBe(10); // 1 * 10 = 10
    });

    test('should calculate correct points for month staking only', () => {
      const breakdown = { day: 0, week: 0, month: 1 };
      const points = StakingService.calculateDailyPointsByPeriod(breakdown);
      expect(points).toBe(20); // 1 * 20 = 20
    });

    test('should calculate correct points for mixed staking periods', () => {
      const breakdown = { day: 2, week: 1, month: 1 };
      const points = StakingService.calculateDailyPointsByPeriod(breakdown);
      expect(points).toBe(44); // (2 * 7) + (1 * 10) + (1 * 20) = 14 + 10 + 20 = 44
    });

    test('should handle zero staking', () => {
      const breakdown = { day: 0, week: 0, month: 0 };
      const points = StakingService.calculateDailyPointsByPeriod(breakdown);
      expect(points).toBe(0);
    });

    test('should handle large numbers correctly', () => {
      const breakdown = { day: 10, week: 5, month: 3 };
      const points = StakingService.calculateDailyPointsByPeriod(breakdown);
      expect(points).toBe(180); // (10 * 7) + (5 * 10) + (3 * 20) = 70 + 50 + 60 = 180
    });
  });

  describe('Total Points Calculation Logic', () => {
    const calculateTotalPoints = (nftCount, stakedBreakdown) => {
      const totalStaked = stakedBreakdown.day + stakedBreakdown.week + stakedBreakdown.month;
      const availableNFTCount = Math.max(0, nftCount - totalStaked);

      if (nftCount > 0) {
        const regularPoints = availableNFTCount * 5;
        const stakingPoints = StakingService.calculateDailyPointsByPeriod(stakedBreakdown);
        return regularPoints + stakingPoints;
      } else {
        return 1; // Regular user base point
      }
    };

    test('should calculate correct total for user with only available NFTs', () => {
      const totalPoints = calculateTotalPoints(5, { day: 0, week: 0, month: 0 });
      expect(totalPoints).toBe(25); // 5 * 5 = 25
    });

    test('should calculate correct total for user with only day-staked NFTs', () => {
      const totalPoints = calculateTotalPoints(2, { day: 2, week: 0, month: 0 });
      expect(totalPoints).toBe(14); // 0 available * 5 + 2 day-staked * 7 = 0 + 14 = 14
    });

    test('should calculate correct total for user with mixed available and staked NFTs', () => {
      const totalPoints = calculateTotalPoints(5, { day: 1, week: 1, month: 1 });
      expect(totalPoints).toBe(47); // 2 available * 5 + (1*7 + 1*10 + 1*20) = 10 + 37 = 47
    });

    test('should handle user with no NFTs', () => {
      const totalPoints = calculateTotalPoints(0, { day: 0, week: 0, month: 0 });
      expect(totalPoints).toBe(1); // Regular user base point
    });

    test('should handle user with all NFTs staked for different periods', () => {
      const totalPoints = calculateTotalPoints(6, { day: 2, week: 2, month: 2 });
      expect(totalPoints).toBe(74); // 0 available * 5 + (2*7 + 2*10 + 2*20) = 0 + 74 = 74
    });
  });
});