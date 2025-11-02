# Requirements Document

## Introduction

This document outlines the requirements for integrating the Shellies Game (game-v2) from an external codebase into the current project. The game is a Mario-inspired platformer that allows Shellies NFT holders to play, earn scores, and compete on a leaderboard. The integration involves copying the game page, components, hooks, API routes, and game assets while ensuring seamless integration with the existing authentication and database infrastructure.

## Glossary

- **Game System**: The complete Shellies Game feature including the game page, game console component, scoring system, and related UI components
- **Game Console Component**: The React component (MarioGameConsoleV2) that renders the game iframe and handles game interactions
- **Score Management System**: The backend and frontend logic that handles saving, retrieving, and updating player game scores
- **Game Assets**: The static HTML/JS/CSS files that contain the actual game implementation, located in the public/mario-game-v2 directory
- **NFT Verification System**: The authentication mechanism that verifies users own Shellies NFTs before allowing game access
- **Leaderboard System**: The ranking system that displays top players based on their game scores
- **Game API Routes**: The Next.js API endpoints that handle score updates and retrieval

## Requirements

### Requirement 1: Game Page Integration

**User Story:** As a Shellies NFT holder, I want to access a dedicated game page in the portal, so that I can play the Shellies Game and earn scores.

#### Acceptance Criteria

1. WHEN a user navigates to the portal, THE Game System SHALL display a "Game" navigation option in the portal menu
2. WHEN a user clicks the Game navigation option, THE Game System SHALL route the user to `/portal/game` page
3. WHEN the game page loads, THE Game System SHALL display the game console with proper styling consistent with the existing portal design
4. THE Game System SHALL include proper metadata for SEO (title, description, keywords, Open Graph tags)

### Requirement 2: Game Console Component Integration

**User Story:** As a player, I want to see the game interface with controls and level navigation, so that I can play the game effectively.

#### Acceptance Criteria

1. THE Game Console Component SHALL render an iframe containing the game at dimensions 1300x650 pixels with responsive scaling
2. THE Game Console Component SHALL display game controls information (Arrow Keys, Space, Shift, Ctrl) with their corresponding actions
3. THE Game Console Component SHALL provide a level navigation input field that accepts numbers between 1 and 999
4. WHEN a user enters a valid level number and presses Enter or clicks Go, THE Game Console Component SHALL send a message to the game iframe to navigate to that level
5. THE Game Console Component SHALL display the game within a styled container with purple-themed borders and gradients matching the portal design

### Requirement 3: Authentication and Access Control

**User Story:** As a non-authenticated user, I want to be prompted to connect my wallet, so that I can access the game features.

#### Acceptance Criteria

1. WHEN a user accesses the game page without a connected wallet, THE Game System SHALL display the GameWalletPrompt component
2. THE GameWalletPrompt component SHALL explain the game features and benefits for all users
3. THE GameWalletPrompt component SHALL provide a wallet connection button using the existing MultiWalletConnect component
4. WHEN a user connects their wallet, THE Game System SHALL display the game console immediately (no NFT verification required)

### Requirement 4: Score Management Integration

**User Story:** As a player, I want my game scores to be automatically saved and tracked, so that I can see my progress and compete on the leaderboard.

#### Acceptance Criteria

1. WHEN the game starts, THE Score Management System SHALL load the user's best score from the database
2. WHEN the game starts, THE Score Management System SHALL send the best score to the game iframe via postMessage
3. WHEN a level is completed, THE Score Management System SHALL receive the current coins collected but SHALL NOT persist the score
4. WHEN the game ends (game over), THE Score Management System SHALL receive the final coins collected
5. IF the final score is greater than the best score, THE Score Management System SHALL update the score in the database
6. THE Score Management System SHALL update localStorage immediately when a new best score is achieved
7. THE Score Management System SHALL throttle database updates with a 5-second delay unless the immediate flag is set
8. WHEN a user is not connected, THE Score Management System SHALL save scores only to localStorage

### Requirement 5: Game API Routes Integration

**User Story:** As a developer, I want API endpoints for score management, so that the game can persist and retrieve player scores.

#### Acceptance Criteria

1. THE Game API Routes SHALL provide a POST endpoint at `/api/game-score` that accepts score and walletAddress
2. WHEN a POST request is received, THE Game API Routes SHALL call the `update_shellies_user_game_score` database function
3. IF the user does not exist in the database, THE Game API Routes SHALL create a new user record with the provided wallet address and score
4. THE Game API Routes SHALL provide a GET endpoint at `/api/game-score` that accepts a walletAddress query parameter
5. WHEN a GET request is received, THE Game API Routes SHALL return the user's game_score from the shellies_raffle_users table
6. IF the user does not exist, THE Game API Routes SHALL return a score of 0
7. THE Game API Routes SHALL return appropriate error responses with status codes for failure scenarios

### Requirement 6: Game Assets Integration

**User Story:** As a player, I want the game to load and run properly, so that I can enjoy the gaming experience.

#### Acceptance Criteria

1. THE Game System SHALL copy all files from the source `public/mario-game-v2` directory to the target project's `public/mario-game-v2` directory
2. THE Game Console Component SHALL load the game from `/mario-game-v2/index.html`
3. THE Game Assets SHALL include all necessary HTML, JavaScript, CSS, images, and audio files required for the game to function
4. THE Game Assets SHALL support postMessage communication for game events (GAME_STARTED, GAME_OVER, LEVEL_COMPLETED, GAME_RESTART, NAVIGATE_TO_LEADERBOARD)
5. THE Game Assets SHALL accept postMessage commands for level navigation (NAVIGATE_TO_LEVEL) and best score updates (BEST_SCORE)

### Requirement 7: Custom Hooks Integration

**User Story:** As a developer, I want reusable hooks for game functionality, so that game features can be easily integrated across components.

#### Acceptance Criteria

1. THE Game System SHALL provide a `useGameScore` hook that manages score state and database interactions
2. THE useGameScore hook SHALL expose currentScore, bestScore, isLoading, error, updateScore, leaderboard, loadLeaderboard, resetLocalScore, flushPendingScore, and hasPendingScore
3. THE useGameScore hook SHALL automatically load the best score when the wallet address changes
4. THE useGameScore hook SHALL handle score throttling with a configurable delay
5. THE useGameScore hook SHALL clean up pending timeouts on unmount

### Requirement 8: Supporting Components Integration

**User Story:** As a user, I want clear prompts and information screens, so that I understand what actions I need to take to access the game.

#### Acceptance Criteria

1. THE Game System SHALL include a GameWalletPrompt component that displays when users are not connected
2. THE GameWalletPrompt component SHALL display game features (Secure Scores, Leaderboard, Fun Gameplay) with icons and descriptions
3. THE GameWalletPrompt component SHALL include animated background elements and particles for visual appeal
4. THE GameWalletPrompt component SHALL emphasize that the game is open to all users, not just NFT holders

### Requirement 9: Navigation Integration

**User Story:** As a player, I want to navigate between the game and leaderboard, so that I can view my ranking and other players' scores.

#### Acceptance Criteria

1. WHEN the game iframe sends a NAVIGATE_TO_LEADERBOARD message, THE Game Console Component SHALL route the user to `/leaderboard`
2. THE Game System SHALL use Next.js router for navigation
3. THE Game System SHALL maintain the user's authentication state during navigation

### Requirement 10: Type Definitions Integration

**User Story:** As a developer, I want proper TypeScript types for game-related data, so that the code is type-safe and maintainable.

#### Acceptance Criteria

1. THE Game System SHALL define a GameScoreUpdate interface with score and walletAddress properties
2. THE Game System SHALL define a GameLeaderboardEntry interface with user information and score properties
3. THE Game System SHALL ensure all game-related functions and components use proper TypeScript types
4. THE Game System SHALL extend existing type definitions in the lib/types file if necessary
