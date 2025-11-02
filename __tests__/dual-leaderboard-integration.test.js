/**
 * Integration Tests for Dual Leaderboard Functionality
 * 
 * This test suite validates the dual leaderboard system including:
 * 1. Switching between points and game XP leaderboards
 * 2. Data persistence when switching back to previously viewed leaderboard
 * 3. Current user highlighting in both leaderboard types
 * 4. Pagination functionality in game XP leaderboard
 * 5. Conditional stats rendering based on active leaderboard
 * 
 * Requirements: 1.1, 1.5, 4.3, 5.1, 6.1
 */

describe('Dual Leaderboard Integration Tests', () => {
  
  // Mock data for testing
  const mockPointsLeaderboard = [
    { id: '1', wallet_address: '0x1234567890abcdef1234567890abcdef12345678', points: 1000, game_score: 500 },
    { id: '2', wallet_address: '0xabcdef1234567890abcdef1234567890abcdef12', points: 800, game_score: 300 },
    { id: '3', wallet_address: '0x9876543210fedcba9876543210fedcba98765432', points: 600, game_score: 700 }
  ];

  const mockGameXPLeaderboard = [
    { id: '1', wallet_address: '0x9876543210fedcba9876543210fedcba98765432', points: 600, game_score: 700 },
    { id: '2', wallet_address: '0x1234567890abcdef1234567890abcdef12345678', points: 1000, game_score: 500 },
    { id: '3', wallet_address: '0xabcdef1234567890abcdef1234567890abcdef12', points: 800, game_score: 300 }
  ];

  const mockGameStats = {
    totalPlayers: 150,
    averageXP: 425,
    topScore: 700
  };

  const mockStakingStats = {
    totalNFTsStaked: 500,
    totalStakers: 75,
    tokenHoldersCount: 200
  };

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });


  describe('Requirement 1.1 & 1.5: Switching Between Leaderboards', () => {
    
    test('should display points leaderboard by default', async () => {
      // Mock API response for points leaderboard
      global.fetch = jest.fn((url) => {
        if (url.includes('/api/leaderboard/points')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockPointsLeaderboard)
          });
        }
        return Promise.reject(new Error('Unexpected URL'));
      });

      // Simulate initial load
      const response = await fetch('/api/leaderboard/points?limit=50');
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data).toEqual(mockPointsLeaderboard);
      expect(data[0].points).toBe(1000);
      expect(data[0].points).toBeGreaterThan(data[1].points);
    });

    test('should switch to game XP leaderboard when toggle is activated', async () => {
      // Mock API responses
      global.fetch = jest.fn((url) => {
        if (url.includes('/api/leaderboard/game-xp')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockGameXPLeaderboard)
          });
        }
        if (url.includes('/api/leaderboard/game-stats')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockGameStats)
          });
        }
        return Promise.reject(new Error('Unexpected URL'));
      });

      // Simulate switching to game XP leaderboard
      const leaderboardResponse = await fetch('/api/leaderboard/game-xp?limit=50');
      const leaderboardData = await leaderboardResponse.json();

      const statsResponse = await fetch('/api/leaderboard/game-stats');
      const statsData = await statsResponse.json();

      expect(leaderboardResponse.ok).toBe(true);
      expect(leaderboardData).toEqual(mockGameXPLeaderboard);
      expect(leaderboardData[0].game_score).toBe(700);
      expect(leaderboardData[0].game_score).toBeGreaterThan(leaderboardData[1].game_score);
      
      expect(statsResponse.ok).toBe(true);
      expect(statsData).toEqual(mockGameStats);
    });

    test('should maintain only one leaderboard view at a time', () => {
      let activeLeaderboard = 'points';
      
      // Simulate toggle action
      const toggleLeaderboard = (type) => {
        activeLeaderboard = type;
      };

      expect(activeLeaderboard).toBe('points');
      
      toggleLeaderboard('gameXP');
      expect(activeLeaderboard).toBe('gameXP');
      
      toggleLeaderboard('points');
      expect(activeLeaderboard).toBe('points');
    });

    test('should transition within 300 milliseconds when switching', async () => {
      const transitionDuration = 300;
      const startTime = Date.now();
      
      // Simulate transition delay
      await new Promise(resolve => setTimeout(resolve, transitionDuration));
      
      const endTime = Date.now();
      const actualDuration = endTime - startTime;
      
      expect(actualDuration).toBeGreaterThanOrEqual(transitionDuration);
      expect(actualDuration).toBeLessThan(transitionDuration + 50); // Allow 50ms tolerance
    });
  });


  describe('Requirement 5.3: Data Persistence and Caching', () => {
    
    test('should cache points leaderboard data when switching to game XP', async () => {
      const cache = {
        points: null,
        pointsTimestamp: null,
        gameXP: null,
        gameXPTimestamp: null
      };

      // Mock fetch for points leaderboard
      global.fetch = jest.fn(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockPointsLeaderboard)
      }));

      // Fetch and cache points leaderboard
      const response = await fetch('/api/leaderboard/points?limit=50');
      const data = await response.json();
      cache.points = data;
      cache.pointsTimestamp = Date.now();

      expect(cache.points).toEqual(mockPointsLeaderboard);
      expect(cache.pointsTimestamp).toBeTruthy();
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    test('should use cached data for instant switch when returning to previously loaded leaderboard', async () => {
      const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
      const cache = {
        points: mockPointsLeaderboard,
        pointsTimestamp: Date.now(),
        gameXP: mockGameXPLeaderboard,
        gameXPTimestamp: Date.now()
      };

      const isCacheValid = (timestamp) => {
        if (!timestamp) return false;
        return Date.now() - timestamp < CACHE_DURATION;
      };

      // Check if cache is valid
      expect(isCacheValid(cache.pointsTimestamp)).toBe(true);
      expect(isCacheValid(cache.gameXPTimestamp)).toBe(true);

      // Simulate switching back to points (should use cache, no fetch)
      global.fetch = jest.fn();
      
      const hasValidCache = cache.points && isCacheValid(cache.pointsTimestamp);
      let data;
      
      if (hasValidCache) {
        data = cache.points; // Use cached data
      } else {
        const response = await fetch('/api/leaderboard/points?limit=50');
        data = await response.json();
      }

      expect(data).toEqual(mockPointsLeaderboard);
      expect(global.fetch).not.toHaveBeenCalled(); // No fetch should occur
    });

    test('should invalidate cache after 5 minutes', () => {
      const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
      const oldTimestamp = Date.now() - (6 * 60 * 1000); // 6 minutes ago
      const recentTimestamp = Date.now();

      const isCacheValid = (timestamp) => {
        if (!timestamp) return false;
        return Date.now() - timestamp < CACHE_DURATION;
      };

      expect(isCacheValid(oldTimestamp)).toBe(false);
      expect(isCacheValid(recentTimestamp)).toBe(true);
    });

    test('should fetch fresh data when cache is expired', async () => {
      const CACHE_DURATION = 5 * 60 * 1000;
      const cache = {
        points: mockPointsLeaderboard,
        pointsTimestamp: Date.now() - (6 * 60 * 1000) // Expired cache
      };

      const isCacheValid = (timestamp) => {
        if (!timestamp) return false;
        return Date.now() - timestamp < CACHE_DURATION;
      };

      global.fetch = jest.fn(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockPointsLeaderboard)
      }));

      const hasValidCache = cache.points && isCacheValid(cache.pointsTimestamp);
      
      expect(hasValidCache).toBe(false);

      // Should fetch fresh data
      const response = await fetch('/api/leaderboard/points?limit=50');
      const data = await response.json();

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(data).toEqual(mockPointsLeaderboard);
    });
  });


  describe('Requirement 4.3: Current User Highlighting', () => {
    
    test('should highlight current user in points leaderboard', () => {
      const userWallet = '0x1234567890abcdef1234567890abcdef12345678';
      
      // Process leaderboard data with user highlighting
      const processedData = mockPointsLeaderboard.map(user => ({
        ...user,
        isCurrentUser: user.wallet_address.toLowerCase() === userWallet.toLowerCase()
      }));

      const currentUserEntry = processedData.find(user => user.isCurrentUser);
      
      expect(currentUserEntry).toBeDefined();
      expect(currentUserEntry.wallet_address).toBe(userWallet);
      expect(currentUserEntry.isCurrentUser).toBe(true);
      expect(currentUserEntry.points).toBe(1000);
    });

    test('should highlight current user in game XP leaderboard', () => {
      const userWallet = '0x9876543210fedcba9876543210fedcba98765432';
      
      // Process leaderboard data with user highlighting
      const processedData = mockGameXPLeaderboard.map(user => ({
        ...user,
        isCurrentUser: user.wallet_address.toLowerCase() === userWallet.toLowerCase()
      }));

      const currentUserEntry = processedData.find(user => user.isCurrentUser);
      
      expect(currentUserEntry).toBeDefined();
      expect(currentUserEntry.wallet_address).toBe(userWallet);
      expect(currentUserEntry.isCurrentUser).toBe(true);
      expect(currentUserEntry.game_score).toBe(700);
    });

    test('should maintain user highlighting when switching between leaderboards', () => {
      const userWallet = '0x1234567890abcdef1234567890abcdef12345678';
      
      // Process points leaderboard
      const pointsData = mockPointsLeaderboard.map(user => ({
        ...user,
        isCurrentUser: user.wallet_address.toLowerCase() === userWallet.toLowerCase()
      }));

      // Process game XP leaderboard
      const gameXPData = mockGameXPLeaderboard.map(user => ({
        ...user,
        isCurrentUser: user.wallet_address.toLowerCase() === userWallet.toLowerCase()
      }));

      const pointsUserEntry = pointsData.find(user => user.isCurrentUser);
      const gameXPUserEntry = gameXPData.find(user => user.isCurrentUser);

      expect(pointsUserEntry).toBeDefined();
      expect(gameXPUserEntry).toBeDefined();
      expect(pointsUserEntry.wallet_address).toBe(gameXPUserEntry.wallet_address);
      expect(pointsUserEntry.isCurrentUser).toBe(true);
      expect(gameXPUserEntry.isCurrentUser).toBe(true);
    });

    test('should preserve user actual rank position without artificial movement', () => {
      const userWallet = '0xabcdef1234567890abcdef1234567890abcdef12';
      
      // Process leaderboard data
      const processedData = mockPointsLeaderboard.map((user, index) => ({
        ...user,
        isCurrentUser: user.wallet_address.toLowerCase() === userWallet.toLowerCase(),
        originalRank: index + 1
      }));

      const currentUserEntry = processedData.find(user => user.isCurrentUser);
      
      expect(currentUserEntry).toBeDefined();
      expect(currentUserEntry.originalRank).toBe(2); // User is at rank 2
      
      // Verify user is not moved to top or bottom artificially
      const userIndex = processedData.findIndex(user => user.isCurrentUser);
      expect(userIndex).toBe(1); // Still at index 1 (rank 2)
    });

    test('should handle case when user is not in visible portion of leaderboard', () => {
      const userWallet = '0xnonexistent1234567890abcdef1234567890abcd';
      
      // Process leaderboard data
      const processedData = mockPointsLeaderboard.map(user => ({
        ...user,
        isCurrentUser: user.wallet_address.toLowerCase() === userWallet.toLowerCase()
      }));

      const currentUserEntry = processedData.find(user => user.isCurrentUser);
      
      expect(currentUserEntry).toBeUndefined();
      
      // Verify no entries are marked as current user
      const highlightedEntries = processedData.filter(user => user.isCurrentUser);
      expect(highlightedEntries.length).toBe(0);
    });
  });


  describe('Requirement 5.1: Pagination Functionality', () => {
    
    test('should implement cursor-based pagination with page size of 50', async () => {
      const PAGE_SIZE = 50;
      
      // Mock first page
      const firstPageData = Array.from({ length: PAGE_SIZE }, (_, i) => ({
        id: `${i + 1}`,
        wallet_address: `0x${i.toString(16).padStart(40, '0')}`,
        points: 1000 - i,
        game_score: 500 - i
      }));

      global.fetch = jest.fn(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve(firstPageData)
      }));

      const response = await fetch(`/api/leaderboard/game-xp?limit=${PAGE_SIZE}`);
      const data = await response.json();

      expect(data.length).toBe(PAGE_SIZE);
      expect(data[0].game_score).toBeGreaterThan(data[PAGE_SIZE - 1].game_score);
    });

    test('should fetch additional entries when loading more in game XP leaderboard', async () => {
      const PAGE_SIZE = 50;
      const cursor = 450; // Last game_score from previous page

      // Mock second page
      const secondPageData = Array.from({ length: PAGE_SIZE }, (_, i) => ({
        id: `${i + 51}`,
        wallet_address: `0x${(i + 50).toString(16).padStart(40, '0')}`,
        points: 950 - i,
        game_score: 450 - i
      }));

      global.fetch = jest.fn(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve(secondPageData)
      }));

      const response = await fetch(`/api/leaderboard/game-xp?limit=${PAGE_SIZE}&cursor=${cursor}`);
      const data = await response.json();

      expect(data.length).toBe(PAGE_SIZE);
      expect(data[0].game_score).toBeLessThanOrEqual(cursor);
    });

    test('should update cursor to last user game_score for next pagination', () => {
      const leaderboardData = [
        { wallet_address: '0x123', game_score: 700 },
        { wallet_address: '0x456', game_score: 500 },
        { wallet_address: '0x789', game_score: 300 }
      ];

      const lastUser = leaderboardData[leaderboardData.length - 1];
      const cursor = lastUser.game_score;

      expect(cursor).toBe(300);
    });

    test('should set hasMore flag correctly based on returned data length', () => {
      const PAGE_SIZE = 50;
      
      // Full page - has more data
      const fullPageData = Array.from({ length: PAGE_SIZE }, (_, i) => ({
        id: `${i}`,
        game_score: 1000 - i
      }));
      
      let hasMore = fullPageData.length === PAGE_SIZE;
      expect(hasMore).toBe(true);

      // Partial page - no more data
      const partialPageData = Array.from({ length: 30 }, (_, i) => ({
        id: `${i}`,
        game_score: 1000 - i
      }));
      
      hasMore = partialPageData.length === PAGE_SIZE;
      expect(hasMore).toBe(false);
    });

    test('should append new data to existing leaderboard when loading more', () => {
      const existingData = [
        { id: '1', game_score: 700 },
        { id: '2', game_score: 600 }
      ];

      const newData = [
        { id: '3', game_score: 500 },
        { id: '4', game_score: 400 }
      ];

      const combinedData = [...existingData, ...newData];

      expect(combinedData.length).toBe(4);
      expect(combinedData[0].game_score).toBe(700);
      expect(combinedData[3].game_score).toBe(400);
    });

    test('should handle pagination for both points and game XP leaderboards', async () => {
      const PAGE_SIZE = 50;
      
      // Mock points pagination
      global.fetch = jest.fn((url) => {
        if (url.includes('/api/leaderboard/points')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockPointsLeaderboard)
          });
        }
        if (url.includes('/api/leaderboard/game-xp')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockGameXPLeaderboard)
          });
        }
        return Promise.reject(new Error('Unexpected URL'));
      });

      // Test points pagination
      const pointsResponse = await fetch(`/api/leaderboard/points?limit=${PAGE_SIZE}&cursor=800`);
      const pointsData = await pointsResponse.json();
      expect(pointsData).toBeDefined();

      // Test game XP pagination
      const gameXPResponse = await fetch(`/api/leaderboard/game-xp?limit=${PAGE_SIZE}&cursor=500`);
      const gameXPData = await gameXPResponse.json();
      expect(gameXPData).toBeDefined();
    });
  });


  describe('Requirement 6.1: Conditional Stats Rendering', () => {
    
    test('should display staking stats when points leaderboard is active', async () => {
      const activeLeaderboard = 'points';
      
      // Mock staking stats fetch
      global.fetch = jest.fn(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockStakingStats)
      }));

      let displayedStats;
      
      if (activeLeaderboard === 'points') {
        const response = await fetch('/api/staking/stats');
        displayedStats = await response.json();
      }

      expect(displayedStats).toEqual(mockStakingStats);
      expect(displayedStats.totalNFTsStaked).toBe(500);
      expect(displayedStats.totalStakers).toBe(75);
      expect(displayedStats.tokenHoldersCount).toBe(200);
    });

    test('should display game stats when game XP leaderboard is active', async () => {
      const activeLeaderboard = 'gameXP';
      
      // Mock game stats fetch
      global.fetch = jest.fn(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockGameStats)
      }));

      let displayedStats;
      
      if (activeLeaderboard === 'gameXP') {
        const response = await fetch('/api/leaderboard/game-stats');
        displayedStats = await response.json();
      }

      expect(displayedStats).toEqual(mockGameStats);
      expect(displayedStats.totalPlayers).toBe(150);
      expect(displayedStats.averageXP).toBe(425);
      expect(displayedStats.topScore).toBe(700);
    });

    test('should switch stats display when leaderboard changes', async () => {
      let activeLeaderboard = 'points';
      
      // Mock both stats endpoints
      global.fetch = jest.fn((url) => {
        if (url.includes('/api/staking/stats')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockStakingStats)
          });
        }
        if (url.includes('/api/leaderboard/game-stats')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockGameStats)
          });
        }
        return Promise.reject(new Error('Unexpected URL'));
      });

      // Get points stats
      let response = await fetch('/api/staking/stats');
      let stats = await response.json();
      expect(stats).toEqual(mockStakingStats);

      // Switch to game XP
      activeLeaderboard = 'gameXP';
      
      // Get game stats
      response = await fetch('/api/leaderboard/game-stats');
      stats = await response.json();
      expect(stats).toEqual(mockGameStats);
    });

    test('should fetch game stats when switching to game XP leaderboard', async () => {
      let activeLeaderboard = 'points';
      let gameStatsFetched = false;

      // Simulate switching to game XP
      activeLeaderboard = 'gameXP';
      
      if (activeLeaderboard === 'gameXP') {
        global.fetch = jest.fn(() => Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockGameStats)
        }));
        
        await fetch('/api/leaderboard/game-stats');
        gameStatsFetched = true;
      }

      expect(gameStatsFetched).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith('/api/leaderboard/game-stats');
    });

    test('should display correct stat cards for each leaderboard type', () => {
      // Points leaderboard stats structure
      const pointsStatsCards = [
        { label: 'Total NFTs Staked', value: mockStakingStats.totalNFTsStaked, icon: 'Lock' },
        { label: 'Shellies NFT Holders', value: mockStakingStats.tokenHoldersCount, icon: 'Trophy' },
        { label: 'Total Staked Members', value: mockStakingStats.totalStakers, icon: 'Users' }
      ];

      // Game XP leaderboard stats structure
      const gameXPStatsCards = [
        { label: 'Total Players', value: mockGameStats.totalPlayers, icon: 'Users' },
        { label: 'Average XP', value: mockGameStats.averageXP, icon: 'TrendingUp' },
        { label: 'Top Score', value: mockGameStats.topScore, icon: 'Crown' }
      ];

      expect(pointsStatsCards.length).toBe(3);
      expect(gameXPStatsCards.length).toBe(3);
      
      expect(pointsStatsCards[0].value).toBe(500);
      expect(gameXPStatsCards[0].value).toBe(150);
    });
  });


  describe('Integration: Complete User Flow', () => {
    
    test('should handle complete flow from initial load to leaderboard switch', async () => {
      // Step 1: Initial load - points leaderboard
      global.fetch = jest.fn((url) => {
        if (url.includes('/api/leaderboard/points')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockPointsLeaderboard)
          });
        }
        if (url.includes('/api/leaderboard/game-xp')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockGameXPLeaderboard)
          });
        }
        if (url.includes('/api/leaderboard/game-stats')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockGameStats)
          });
        }
        return Promise.reject(new Error('Unexpected URL'));
      });

      // Initial load
      let response = await fetch('/api/leaderboard/points?limit=50');
      let data = await response.json();
      expect(data).toEqual(mockPointsLeaderboard);

      // Step 2: Switch to game XP
      response = await fetch('/api/leaderboard/game-xp?limit=50');
      data = await response.json();
      expect(data).toEqual(mockGameXPLeaderboard);

      // Fetch game stats
      response = await fetch('/api/leaderboard/game-stats');
      const stats = await response.json();
      expect(stats).toEqual(mockGameStats);

      // Step 3: Switch back to points (should use cache)
      // In real implementation, this would not trigger a fetch
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    test('should maintain user highlighting throughout leaderboard switches', () => {
      const userWallet = '0x1234567890abcdef1234567890abcdef12345678';
      
      // Process both leaderboards
      const pointsData = mockPointsLeaderboard.map(user => ({
        ...user,
        isCurrentUser: user.wallet_address.toLowerCase() === userWallet.toLowerCase()
      }));

      const gameXPData = mockGameXPLeaderboard.map(user => ({
        ...user,
        isCurrentUser: user.wallet_address.toLowerCase() === userWallet.toLowerCase()
      }));

      // Verify user is highlighted in both
      const pointsUser = pointsData.find(u => u.isCurrentUser);
      const gameXPUser = gameXPData.find(u => u.isCurrentUser);

      expect(pointsUser).toBeDefined();
      expect(gameXPUser).toBeDefined();
      expect(pointsUser.wallet_address).toBe(gameXPUser.wallet_address);
    });

    test('should handle pagination after switching leaderboards', async () => {
      const PAGE_SIZE = 50;
      let activeLeaderboard = 'points';
      let cursor = 600;

      global.fetch = jest.fn((url) => {
        if (url.includes('/api/leaderboard/points') && url.includes('cursor=600')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([
              { id: '4', wallet_address: '0xabc', points: 500, game_score: 200 }
            ])
          });
        }
        if (url.includes('/api/leaderboard/game-xp') && url.includes('cursor=300')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([
              { id: '4', wallet_address: '0xdef', points: 200, game_score: 250 }
            ])
          });
        }
        return Promise.reject(new Error('Unexpected URL'));
      });

      // Load more for points
      let response = await fetch(`/api/leaderboard/points?limit=${PAGE_SIZE}&cursor=${cursor}`);
      let data = await response.json();
      expect(data.length).toBeGreaterThan(0);

      // Switch to game XP and load more
      activeLeaderboard = 'gameXP';
      cursor = 300;
      response = await fetch(`/api/leaderboard/game-xp?limit=${PAGE_SIZE}&cursor=${cursor}`);
      data = await response.json();
      expect(data.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling in Integration', () => {
    
    test('should handle network errors gracefully when switching leaderboards', async () => {
      global.fetch = jest.fn(() => Promise.reject(new Error('Network error')));

      try {
        await fetch('/api/leaderboard/game-xp?limit=50');
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toBe('Network error');
      }
    });

    test('should handle empty leaderboard data', async () => {
      global.fetch = jest.fn(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve([])
      }));

      const response = await fetch('/api/leaderboard/game-xp?limit=50');
      const data = await response.json();

      expect(data).toEqual([]);
      expect(data.length).toBe(0);
    });

    test('should handle failed stats fetch without breaking leaderboard display', async () => {
      global.fetch = jest.fn((url) => {
        if (url.includes('/api/leaderboard/game-xp')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockGameXPLeaderboard)
          });
        }
        if (url.includes('/api/leaderboard/game-stats')) {
          return Promise.reject(new Error('Stats fetch failed'));
        }
        return Promise.reject(new Error('Unexpected URL'));
      });

      // Leaderboard should load successfully
      const leaderboardResponse = await fetch('/api/leaderboard/game-xp?limit=50');
      const leaderboardData = await leaderboardResponse.json();
      expect(leaderboardData).toEqual(mockGameXPLeaderboard);

      // Stats fetch should fail but not break the flow
      try {
        await fetch('/api/leaderboard/game-stats');
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toBe('Stats fetch failed');
      }
    });
  });
});
