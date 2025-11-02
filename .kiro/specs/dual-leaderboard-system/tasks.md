# Implementation Plan

- [x] 1. Create backend API endpoints for dual leaderboard system





  - Create new API route `/api/leaderboard/game-xp` that returns users sorted by game_score in descending order
  - Create new API route `/api/leaderboard/game-stats` that returns aggregated game statistics (total players, average XP, top score)
  - Update existing `/api/leaderboard/route.ts` to be renamed to `/api/leaderboard/points/route.ts` for clarity
  - Implement cursor-based pagination for game XP leaderboard with limit and cursor query parameters
  - Add user wallet highlighting logic to game XP endpoint similar to points endpoint
  - _Requirements: 1.2, 1.3, 1.4, 5.1, 5.2_

- [x] 2. Extend UserService with game XP leaderboard methods





  - Add `getGameXPLeaderboard()` method to UserService class that queries users sorted by game_score
  - Add `getGameStats()` method to UserService class that aggregates total players, average XP, and top score
  - Implement cursor-based pagination logic in getGameXPLeaderboard method
  - Add user highlighting logic to mark current user in game XP leaderboard results
  - _Requirements: 1.3, 6.2_

- [x] 3. Create StunningToggleSwitcher component





  - Create new component file `src/components/portal/StunningToggleSwitcher.tsx`
  - Implement pill-shaped container with sliding indicator animation
  - Add two tab buttons: "Points" (with Trophy icon) and "Game XP" (with Gamepad2 icon from lucide-react)
  - Implement smooth sliding animation (300ms duration) for the active indicator using CSS transforms
  - Add gradient backgrounds for active state (purple-to-pink gradient)
  - Implement hover effects with scale transformations and shadow enhancements
  - Support dark and light theme styling using isDarkMode prop
  - Add onClick handlers that emit activeTab change events to parent component
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 4. Update LeaderboardPage state management for dual leaderboards





  - Add state variable `activeLeaderboard` with type 'points' | 'gameXP', default to 'points'
  - Add separate state for points leaderboard: `pointsLeaderboard`, `pointsLoading`, `pointsCursor`, `pointsHasMore`
  - Add separate state for game XP leaderboard: `gameXPLeaderboard`, `gameXPLoading`, `gameXPCursor`, `gameXPHasMore`
  - Add state for game statistics: `gameStats` with totalPlayers, averageXP, topScore fields
  - Create `fetchPointsLeaderboard()` function that calls `/api/leaderboard/points` endpoint
  - Create `fetchGameXPLeaderboard()` function that calls `/api/leaderboard/game-xp` endpoint
  - Create `fetchGameStats()` function that calls `/api/leaderboard/game-stats` endpoint
  - Implement toggle handler that switches activeLeaderboard state and triggers data fetch if not cached
  - _Requirements: 1.1, 1.2, 1.5, 5.3_

- [x] 5. Implement conditional stats cards rendering





  - Create `GameStatsCards` component that displays three cards: Total Players, Average XP, Top Score
  - Style GameStatsCards with gradient backgrounds, icons (Users, TrendingUp, Crown), and hover effects matching existing design
  - Update LeaderboardPage to conditionally render stats based on activeLeaderboard state
  - When activeLeaderboard is 'points', display existing StakingStats cards
  - When activeLeaderboard is 'gameXP', display new GameStatsCards component
  - Implement useEffect hook to fetch game stats when switching to game XP leaderboard
  - _Requirements: 6.1, 6.2, 6.3, 6.4_
- [x] 6. Update leaderboard rendering logic for dual display




- [ ] 6. Update leaderboard rendering logic for dual display

  - Modify leaderboard map function to display data from active leaderboard (pointsLeaderboard or gameXPLeaderboard)
  - Update metric display section to show either "Points" or "XP" label based on activeLeaderboard
  - Update metric value to display user.points or user.game_score based on activeLeaderboard
  - Ensure current user highlighting works for both leaderboard types
  - Update empty state message to be contextual ("No points data yet" vs "No game XP data yet")
  - _Requirements: 1.5, 3.5, 4.1, 4.2, 4.3_
-

- [x] 7. Implement pagination for game XP leaderboard




  - Update loadMore function to handle both leaderboard types based on activeLeaderboard state
  - When activeLeaderboard is 'gameXP', call fetchGameXPLeaderboard with gameXPCursor
  - Update cursor logic to use game_score for game XP leaderboard pagination
  - Ensure hasMore flag is correctly set for both leaderboard types
  - Update "Load More" button to show correct loading state for active leaderboard
  - _Requirements: 5.1, 5.4_
-

- [x] 8. Add smooth transitions and animations for leaderboard switching




  - Implement fade-out/fade-in transition when switching between leaderboards (300ms duration)
  - Add loading skeleton display during leaderboard data fetching on switch
  - Implement CSS transitions for leaderboard container using opacity and transform
  - Add spring animation to toggle switcher indicator using cubic-bezier easing
  - Ensure animations respect user's reduced motion preferences
  - _Requirements: 2.3, 3.3, 5.2, 5.5_

- [x] 9. Enhance rank badges and visual styling




  - Update getRankBadge function to add pulsing animation for top 3 positions
  - Add gradient glow effects to rank 1 badge (gold with pulsing shadow)
  - Enhance hover effects on leaderboard entries with scale and shadow transitions
  - Update current user highlight to use distinctive gradient background with border accent
  - Ensure all visual enhancements work in both light and dark themes
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
- [x] 10. Integrate StunningToggleSwitcher into LeaderboardPage




- [ ] 10. Integrate StunningToggleSwitcher into LeaderboardPage

  - Import StunningToggleSwitcher component into LeaderboardPage
  - Place toggle switcher in the header section below the page title and description
  - Pass activeLeaderboard state and toggle handler to StunningToggleSwitcher
  - Pass isDarkMode prop from ThemeContext to StunningToggleSwitcher
  - Ensure toggle switcher is responsive and works on mobile devices
  - _Requirements: 2.1, 2.2, 2.5_

- [x] 11. Add database indexes for performance optimization





  - Create migration file to add index on game_score column in shellies_raffle_users table
  - Ensure existing index on points column exists for optimal query performance
  - Add composite index on (game_score DESC, wallet_address ASC) for game XP leaderboard queries
  - Add composite index on (points DESC, wallet_address ASC) for points leaderboard queries if not exists
  - _Requirements: 5.1_
-

- [x] 12. Implement data caching strategy for leaderboard switching




  - Add logic to cache points leaderboard data when switching to game XP view
  - Add logic to cache game XP leaderboard data when switching to points view
  - Implement instant switch when returning to previously loaded leaderboard (no loading state)
  - Add cache invalidation on manual refresh or after 5 minutes
  - _Requirements: 5.3_

- [x] 13. Add error handling and empty states




  - Implement error handling for failed API requests in fetchGameXPLeaderboard
  - Implement error handling for failed API requests in fetchGameStats
  - Add retry button for failed leaderboard fetches
  - Create contextual empty state messages for each leaderboard type
  - Add error toast notifications for network failures
  - _Requirements: 4.5_

- [x] 14. Add accessibility features





  - Add ARIA labels to toggle switcher buttons ("Switch to Points Leaderboard", "Switch to Game XP Leaderboard")
  - Add ARIA live region to announce leaderboard changes to screen readers
  - Implement keyboard navigation for toggle switcher (Tab, Enter, Space keys)
  - Add focus indicators to toggle buttons with visible outline
  - Ensure all interactive elements have proper focus states
  - _Requirements: 2.2, 2.3_
-

- [x] 15. Write integration tests for dual leaderboard functionality




  - Write test for switching between points and game XP leaderboards
  - Write test for data persistence when switching back to previously viewed leaderboard
  - Write test for current user highlighting in both leaderboard types
  - Write test for pagination functionality in game XP leaderboard
  - Write test for conditional stats rendering based on active leaderboard
  - _Requirements: 1.1, 1.5, 4.3, 5.1, 6.1_
