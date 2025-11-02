# Implementation Plan

- [x] 1. Copy game assets from source project





  - Copy the entire `public/mario-game-v2/` directory from source project to target project
  - Verify all files are copied successfully (HTML, JS, CSS, images, audio)
  - Test that the game loads correctly from `/mario-game-v2/index.html`
  - _Requirements: 6.1, 6.2, 6.3_


- [x] 2. Create useGameScore hook




  - Create `src/hooks/useGameScore.ts` file
  - Implement state management for currentScore, bestScore, isLoading, error
  - Implement loadBestScore function that fetches from API or localStorage
  - Implement updateScore function with throttling logic (5-second delay)
  - Implement updateScoreToDatabase function for API calls
  - Implement loadLeaderboard, resetLocalScore, and flushPendingScore functions
  - Add cleanup logic for timeouts on unmount
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 3. Create game API routes





  - Create `src/app/api/game-score/route.ts` file
  - Implement POST endpoint that accepts score and walletAddress
  - Call `update_raffle_user_game_score` database function
  - Handle user creation if user doesn't exist
  - Implement GET endpoint that accepts walletAddress query parameter
  - Return user's game_score or 0 if user doesn't exist
  - Add proper error handling and status codes
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

- [x] 4. Create GameWalletPrompt component





  - Create `src/components/GameWalletPrompt.tsx` file
  - Implement animated background with gradients and particles
  - Add game features grid (Secure Scores, Leaderboard, Fun Gameplay)
  - Integrate MultiWalletConnect component
  - Update messaging to reflect game is open to all users
  - Add framer-motion animations
  - Style with Tailwind CSS matching portal theme
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 5. Create MarioGameConsoleV2 component





  - Create `src/components/MarioGameConsoleV2.tsx` file
  - Implement conditional rendering based on wallet connection
  - Add game iframe with proper dimensions (1300x650)
  - Implement level navigation input and validation (1-999)
  - Add game controls display section
  - Set up useRef for iframe reference
  - Integrate useAccount, useRouter, and useGameScore hooks
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 6. Implement postMessage communication in MarioGameConsoleV2





  - Add useEffect to listen for postMessage events
  - Implement GAME_STARTED handler (send best score to game)
  - Implement GAME_OVER handler (update score if new best)
  - Implement LEVEL_COMPLETED handler (send best score, don't persist)
  - Implement GAME_RESTART handler (reset game state)
  - Implement NAVIGATE_TO_LEADERBOARD handler (route to leaderboard)
  - Add origin validation for security
  - Implement BEST_SCORE command sender
  - Implement NAVIGATE_TO_LEVEL command sender
  - _Requirements: 4.2, 4.3, 4.4, 4.5, 6.4, 6.5, 9.1_

- [x] 7. Create game page





  - Create `src/app/portal/game/page.tsx` file
  - Add metadata for SEO (title, description, keywords, Open Graph)
  - Import and render MarioGameConsoleV2 component
  - Use existing portal layout structure
  - _Requirements: 1.3, 1.4_

- [x] 8. Add game navigation to portal menu





  - Locate portal navigation component (likely in `src/app/portal/layout.tsx` or a navigation component)
  - Add "Game" link to navigation menu pointing to `/portal/game`
  - Ensure proper styling and active state handling
  - _Requirements: 1.1, 1.2_

- [x] 9. Add TypeScript type definitions





  - Open `src/lib/types.ts` or create if doesn't exist
  - Add GameScoreUpdate interface (score: number, walletAddress: string)
  - Add GameLeaderboardEntry interface (wallet_address, game_score, username?, avatar?, rank?)
  - Export types for use across the application
  - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [ ] 10. Verify database schema and functions
  - Check that `shellies_raffle_users` table has `game_score` column
  - Verify `update_raffle_user_game_score` database function exists
  - Test function with sample data if needed
  - Document any missing database components
  - _Requirements: 5.2, 5.3_

- [ ] 11. Integration testing and bug fixes
  - Test wallet connection flow
  - Test game loading in iframe
  - Test score updates on game over
  - Test level navigation functionality
  - Test navigation to leaderboard
  - Test localStorage fallback when not connected
  - Test score persistence across page refreshes
  - Fix any bugs discovered during testing
  - _Requirements: All_
