# Design Document

## Overview

This design document outlines the technical approach for integrating the Shellies Game (game-v2) into the current project. The integration involves copying game assets, components, hooks, and API routes from the source project while ensuring seamless integration with the existing portal infrastructure. The design follows the existing architectural patterns in the project, including Next.js App Router, React hooks, Supabase for data persistence, and wagmi for wallet connectivity.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Portal Navigation                        │
│              (Add "Game" link to menu)                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  /portal/game (New Page)                     │
│  ┌───────────────────────────────────────────────────────┐  │
│  │         Authentication & Access Control               │  │
│  │  - Check wallet connection (useAccount)               │  │
│  └───────────────────────────────────────────────────────┘  │
│                              │                               │
│              ┌───────────────┴───────────────┐              │
│              ▼                               ▼              │
│  ┌──────────────────────┐      ┌──────────────────────┐    │
│  │  GameWalletPrompt    │      │  MarioGameConsoleV2  │    │
│  │  (Not Connected)     │      │  (Main Game)         │    │
│  └──────────────────────┘      └──────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Game Iframe                               │
│         /mario-game-v2/index.html                            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │         PostMessage Communication                     │  │
│  │  Events: GAME_STARTED, GAME_OVER, LEVEL_COMPLETED    │  │
│  │  Commands: BEST_SCORE, NAVIGATE_TO_LEVEL             │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Score Management                           │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              useGameScore Hook                        │  │
│  │  - Load best score from DB/localStorage              │  │
│  │  - Update score with throttling (5s delay)           │  │
│  │  - Persist to DB via API                             │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Routes                                │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  POST /api/game-score                                 │  │
│  │  - Update user score in database                     │  │
│  │  - Create user if doesn't exist                      │  │
│  │                                                       │  │
│  │  GET /api/game-score?walletAddress=...               │  │
│  │  - Retrieve user's best score                        │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Supabase Database                           │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  shellies_raffle_users table                          │  │
│  │  - wallet_address (primary key)                       │  │
│  │  - game_score (integer)                               │  │
│  │  - other user fields...                               │  │
│  │                                                       │  │
│  │  update_raffle_user_game_score() function             │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Game Page Component

**Location:** `src/app/portal/game/page.tsx`

**Purpose:** Main entry point for the game feature, handles routing and metadata.

**Design:**
- Server component that exports metadata for SEO
- Renders the MarioGameConsoleV2 component
- Uses existing portal layout (inherits from parent layout.tsx)
- Follows the same structure as other portal pages (leaderboard, profile, etc.)

**Dependencies:**
- MarioGameConsoleV2 component
- Next.js Metadata API

### 2. MarioGameConsoleV2 Component

**Location:** `src/components/MarioGameConsoleV2.tsx`

**Purpose:** Main game interface component that manages game state, authentication, and score updates.

**Design:**
```typescript
interface MarioGameConsoleV2Props {
  // No props needed - uses hooks for state management
}

Component State:
- gameStarted: boolean - tracks if game has started
- levelInput: string - stores user input for level navigation

Hooks Used:
- useAccount() - wagmi hook for wallet connection
- useRouter() - Next.js navigation
- useGameScore() - custom hook for score management
- useRef<HTMLIFrameElement> - reference to game iframe
```

**Key Features:**
1. **Conditional Rendering:**
   - Not connected → GameWalletPrompt
   - Connected → Game Console (no NFT verification required)

2. **PostMessage Communication:**
   - Listens for game events (GAME_OVER, LEVEL_COMPLETED, GAME_STARTED, GAME_RESTART, NAVIGATE_TO_LEADERBOARD)
   - Sends commands to game (BEST_SCORE, NAVIGATE_TO_LEVEL)

3. **Score Management:**
   - On GAME_OVER: Update score if it's a new best
   - On LEVEL_COMPLETED: Don't persist score, just send current best
   - On GAME_STARTED: Send current best score to game

4. **Level Navigation:**
   - Input field for level numbers (1-999)
   - Validation before sending to game
   - Keyboard support (Enter key)

**Styling:**
- Uses Tailwind CSS with purple/blue gradient theme
- Framer Motion for animations
- Lucide React icons
- Responsive design with max-width constraints

### 3. GameWalletPrompt Component

**Location:** `src/components/GameWalletPrompt.tsx`

**Purpose:** Displays when user is not connected, prompts wallet connection.

**Design:**
- Client component with animated background
- Features grid showing benefits (Secure Scores, Leaderboard, Exclusive Access)
- Integrates MultiWalletConnect component
- Animated particles and gradient backgrounds
- Back to home navigation option

**Dependencies:**
- MultiWalletConnect component (existing)
- framer-motion for animations
- lucide-react for icons

**Note:** The game description in this component should be updated to reflect that the game is open to all users, not just NFT holders.

### 4. useGameScore Hook

**Location:** `src/hooks/useGameScore.ts`

**Purpose:** Manages game score state and database interactions.

**Design:**
```typescript
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
```

**Key Logic:**

1. **Score Loading:**
   - On mount/wallet change: Load best score from API
   - Fallback to localStorage if API fails or user not connected

2. **Score Update Strategy:**
   - Immediate localStorage update for new best scores
   - Throttled database updates (5-second delay)
   - Immediate database update if `immediate` flag is true
   - Only update database if score is higher than current best

3. **Throttling Mechanism:**
   - Uses useRef to store timeout
   - Clears previous timeout when new score comes in
   - Cleanup on unmount

4. **Offline Support:**
   - Works without wallet connection using localStorage
   - Syncs to database when wallet connects

## Data Models

### GameScoreUpdate Interface

```typescript
interface GameScoreUpdate {
  score: number;
  walletAddress: string;
}
```

### GameLeaderboardEntry Interface

```typescript
interface GameLeaderboardEntry {
  wallet_address: string;
  game_score: number;
  // Additional user fields from shellies_raffle_users table
  username?: string;
  avatar?: string;
  rank?: number;
}
```

### Database Schema

The integration assumes the `shellies_raffle_users` table already exists with the following relevant fields:

```sql
CREATE TABLE shellies_raffle_users (
  wallet_address TEXT PRIMARY KEY,
  game_score INTEGER DEFAULT 0,
  -- other fields...
);
```

The integration also assumes a database function exists:

```sql
CREATE OR REPLACE FUNCTION update_raffle_user_game_score(
  user_wallet TEXT,
  new_score INTEGER
) RETURNS TABLE (game_score INTEGER) AS $$
BEGIN
  UPDATE shellies_raffle_users
  SET game_score = GREATEST(game_score, new_score)
  WHERE wallet_address = user_wallet
  RETURNING game_score;
END;
$$ LANGUAGE plpgsql;
```

## API Routes

### POST /api/game-score

**Location:** `src/app/api/game-score/route.ts`

**Purpose:** Update user's game score in the database.

**Request Body:**
```typescript
{
  score: number;
  walletAddress: string;
}
```

**Response:**
```typescript
{
  success: boolean;
  game_score: number;
  isNewBest: boolean;
}
```

**Logic:**
1. Call `update_shellies_user_game_score` RPC function
2. If user doesn't exist (error), create new user with INSERT
3. Return updated score and success status

**Error Handling:**
- 500 status for database errors
- Automatic user creation if user doesn't exist

### GET /api/game-score

**Location:** `src/app/api/game-score/route.ts`

**Purpose:** Retrieve user's best game score.

**Query Parameters:**
- `walletAddress`: string (required)

**Response:**
```typescript
{
  success: boolean;
  game_score: number;
}
```

**Logic:**
1. Query shellies_raffle_users table for wallet_address
2. Return game_score or 0 if user doesn't exist
3. Always return success: true (graceful degradation)

## Game Assets Structure

### Source Location
`D:\my_projects\shellies\public\mario-game-v2\`

### Target Location
`public/mario-game-v2/`

### Asset Types
- `index.html` - Main game entry point
- JavaScript files - Game logic and engine
- CSS files - Game styling
- Image assets - Sprites, backgrounds, tiles
- Audio files - Sound effects and music

### PostMessage Protocol

**Events from Game to Parent:**
```typescript
// Game started
{ type: 'GAME_STARTED' }

// Level completed (don't persist score)
{ type: 'LEVEL_COMPLETED', coins: number }

// Game over (persist if new best)
{ type: 'GAME_OVER', coins: number }

// Game restarted
{ type: 'GAME_RESTART' }

// Navigate to leaderboard
{ type: 'NAVIGATE_TO_LEADERBOARD' }
```

**Commands from Parent to Game:**
```typescript
// Send best score to game
{ type: 'BEST_SCORE', bestScore: number }

// Navigate to specific level
{ type: 'NAVIGATE_TO_LEVEL', level: number }
```

## Error Handling

### 1. API Errors

**Strategy:** Graceful degradation with localStorage fallback

- If API fails to load score: Use localStorage value
- If API fails to save score: Keep in localStorage, retry later
- Display error messages to user only for critical failures

### 2. Game Loading Errors

**Strategy:** Iframe error handling

- Monitor iframe load events
- Display error message if game fails to load
- Provide reload option

### 3. PostMessage Errors

**Strategy:** Origin validation and error logging

- Validate message origin matches window.location.origin
- Log unexpected messages to console
- Ignore messages from unknown origins

## Testing Strategy

### Unit Tests

1. **useGameScore Hook Tests:**
   - Test score loading from API
   - Test localStorage fallback
   - Test score update throttling
   - Test immediate score updates
   - Test cleanup on unmount

2. **API Route Tests:**
   - Test POST /api/game-score with valid data
   - Test POST /api/game-score with new user
   - Test GET /api/game-score with existing user
   - Test GET /api/game-score with non-existent user

### Integration Tests

1. **Game Flow Tests:**
   - Test wallet connection flow
   - Test NFT verification flow
   - Test game start and score update
   - Test level navigation
   - Test leaderboard navigation

2. **PostMessage Communication Tests:**
   - Test GAME_OVER event handling
   - Test LEVEL_COMPLETED event handling
   - Test BEST_SCORE command sending
   - Test NAVIGATE_TO_LEVEL command sending

### Manual Testing Checklist

1. **Authentication Flow:**
   - [ ] Verify GameWalletPrompt shows when not connected
   - [ ] Verify wallet connection works
   - [ ] Verify game console shows after wallet connection

2. **Game Functionality:**
   - [ ] Verify game loads in iframe
   - [ ] Verify game controls work
   - [ ] Verify level navigation works
   - [ ] Verify score updates on game over
   - [ ] Verify best score persists across sessions

3. **Score Management:**
   - [ ] Verify score saves to database
   - [ ] Verify score loads from database
   - [ ] Verify localStorage fallback works
   - [ ] Verify throttling works (5-second delay)
   - [ ] Verify immediate updates work on game over

4. **Navigation:**
   - [ ] Verify navigation to leaderboard works
   - [ ] Verify back navigation works
   - [ ] Verify portal menu shows game link

## Performance Considerations

### 1. Score Update Throttling

**Rationale:** Reduce database writes and API calls

- 5-second delay for non-critical updates
- Immediate updates only on game over
- Batch updates when possible

### 2. Lazy Loading

**Rationale:** Improve initial page load time

- Game assets loaded only when iframe renders
- Components use dynamic imports where appropriate

### 3. Memoization

**Rationale:** Prevent unnecessary re-renders

- Use React.memo for expensive components
- Use useMemo for computed values
- Use useCallback for event handlers

### 4. LocalStorage Caching

**Rationale:** Reduce API calls and improve offline experience

- Cache best score in localStorage
- Sync with database when connected
- Fallback to localStorage when offline

## Security Considerations

### 1. PostMessage Origin Validation

**Implementation:**
```typescript
if (event.origin !== window.location.origin) return;
```

**Rationale:** Prevent malicious messages from external sources

### 2. Input Validation

**Implementation:**
- Validate level numbers (1-999)
- Validate score values (positive integers)
- Sanitize wallet addresses

### 3. API Authentication

**Assumption:** Existing API routes use session-based authentication

**Verification:** Ensure game-score API validates user session

### 4. Database Security

**Assumption:** Supabase RLS policies are in place

**Verification:** Ensure users can only update their own scores

## Migration and Deployment

### File Copy Operations

1. **Game Assets:**
   - Copy `public/mario-game-v2/` directory recursively
   - Verify all files copied successfully
   - Test game loads from new location

2. **Components:**
   - Copy MarioGameConsoleV2.tsx
   - Copy GameWalletPrompt.tsx
   - Copy NftVerificationPrompt.tsx (if doesn't exist)

3. **Hooks:**
   - Copy useGameScore.ts
   - Verify useNftVerification.ts exists or copy it

4. **API Routes:**
   - Copy game-score route.ts
   - Verify database function exists

5. **Types:**
   - Add GameScoreUpdate and GameLeaderboardEntry to lib/types.ts

### Portal Navigation Update

**File:** `src/app/portal/layout.tsx` or navigation component

**Change:** Add "Game" link to portal menu

```typescript
const navItems = [
  { name: 'Dashboard', href: '/portal' },
  { name: 'Raffles', href: '/portal/raffles' },
  { name: 'Staking', href: '/portal/staking' },
  { name: 'Game', href: '/portal/game' }, // NEW
  { name: 'Leaderboard', href: '/portal/leaderboard' },
  { name: 'Profile', href: '/portal/profile' },
];
```

### Database Verification

1. Verify `shellies_raffle_users` table has `game_score` column
2. Verify `update_raffle_user_game_score` function exists
3. Test function with sample data

### Environment Variables

No new environment variables required. Uses existing:
- Supabase URL and keys
- Wallet connection configuration

## Rollback Plan

If issues arise during deployment:

1. **Remove Game Page:**
   - Delete `src/app/portal/game/` directory

2. **Remove Navigation Link:**
   - Remove game link from portal menu

3. **Keep API Routes:**
   - API routes can remain as they don't affect existing functionality

4. **Keep Components:**
   - Components can remain as they're not imported elsewhere

5. **Database:**
   - No database changes needed, existing schema supports game scores
