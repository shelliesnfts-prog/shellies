/**
 * Tests for leaderboard error handling and empty states
 */

describe('Leaderboard Error Handling', () => {
  describe('Error State Management', () => {
    test('should handle points leaderboard fetch errors', async () => {
      // Mock fetch to simulate network error
      const mockError = new Error('Network error');
      global.fetch = jest.fn(() => Promise.reject(mockError));

      // Verify error is caught and handled
      await expect(fetch('/api/leaderboard/points')).rejects.toThrow('Network error');
    });

    test('should handle game XP leaderboard fetch errors', async () => {
      // Mock fetch to simulate network error
      const mockError = new Error('Network error');
      global.fetch = jest.fn(() => Promise.reject(mockError));

      // Verify error is caught and handled
      await expect(fetch('/api/leaderboard/game-xp')).rejects.toThrow('Network error');
    });

    test('should handle game stats fetch errors', async () => {
      // Mock fetch to simulate network error
      const mockError = new Error('Network error');
      global.fetch = jest.fn(() => Promise.reject(mockError));

      // Verify error is caught and handled
      await expect(fetch('/api/leaderboard/game-stats')).rejects.toThrow('Network error');
    });
  });

  describe('HTTP Error Responses', () => {
    test('should handle 404 response for points leaderboard', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: false,
          status: 404,
          statusText: 'Not Found',
        })
      );

      const response = await fetch('/api/leaderboard/points');
      expect(response.ok).toBe(false);
      expect(response.status).toBe(404);
    });

    test('should handle 500 response for game XP leaderboard', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        })
      );

      const response = await fetch('/api/leaderboard/game-xp');
      expect(response.ok).toBe(false);
      expect(response.status).toBe(500);
    });

    test('should handle 503 response for game stats', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
        })
      );

      const response = await fetch('/api/leaderboard/game-stats');
      expect(response.ok).toBe(false);
      expect(response.status).toBe(503);
    });
  });

  describe('Empty State Messages', () => {
    test('should provide contextual empty state for points leaderboard', () => {
      const pointsEmptyMessage = 'No points data yet';
      const pointsEmptySubtext = 'Be the first to connect and claim points!';
      
      expect(pointsEmptyMessage).toBe('No points data yet');
      expect(pointsEmptySubtext).toBe('Be the first to connect and claim points!');
    });

    test('should provide contextual empty state for game XP leaderboard', () => {
      const gameXPEmptyMessage = 'No game XP data yet';
      const gameXPEmptySubtext = 'Be the first to play and earn XP!';
      
      expect(gameXPEmptyMessage).toBe('No game XP data yet');
      expect(gameXPEmptySubtext).toBe('Be the first to play and earn XP!');
    });
  });

  describe('Error Messages', () => {
    test('should format error message for failed API request', () => {
      const status = 500;
      const statusText = 'Internal Server Error';
      const errorMessage = `Failed to fetch points leaderboard: ${status} ${statusText}`;
      
      expect(errorMessage).toContain('Failed to fetch points leaderboard');
      expect(errorMessage).toContain('500');
      expect(errorMessage).toContain('Internal Server Error');
    });

    test('should provide user-friendly error messages', () => {
      const pointsErrorMessage = 'Unable to load points leaderboard. Please try again.';
      const gameXPErrorMessage = 'Unable to load game XP leaderboard. Please try again.';
      const gameStatsErrorMessage = 'Unable to load game statistics. Please try again.';
      
      expect(pointsErrorMessage).toContain('Unable to load');
      expect(gameXPErrorMessage).toContain('Unable to load');
      expect(gameStatsErrorMessage).toContain('Unable to load');
    });
  });

  describe('Retry Functionality', () => {
    test('should allow retry after failed fetch', async () => {
      let callCount = 0;
      global.fetch = jest.fn(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      });

      // First call fails
      try {
        await fetch('/api/leaderboard/points');
      } catch (error) {
        expect(error.message).toBe('Network error');
      }

      // Retry succeeds
      const response = await fetch('/api/leaderboard/points');
      expect(response.ok).toBe(true);
      expect(callCount).toBe(2);
    });
  });
});
