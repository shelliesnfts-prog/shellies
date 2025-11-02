# Design Document

## Overview

The dual-leaderboard system transforms the existing single-view leaderboard into a sophisticated, visually stunning interface that separates Game XP and Points rankings. The design emphasizes smooth transitions, modern aesthetics, and an engaging user experience through carefully crafted animations, gradients, and interactive elements.

The system maintains the existing pagination and user highlighting features while introducing a new toggle mechanism and optimized data fetching strategies for each leaderboard type.

## Architecture

### Component Structure

```
LeaderboardPage (Main Container)
├── PortalSidebar
├── LeaderboardHeader
│   ├── Title & Description
│   └── StunningToggleSwitcher
│       ├── GameXPTab
│       └── PointsTab
├── StatsCardsSection
│   ├── PointsStats (conditional)
│   │   ├── TotalNFTsStakedCard
│   │   ├── TokenHoldersCard
│   │   └── TotalStakersCard
│   └── GameXPStats (conditional)
│       ├── TotalPlayersCard
│       ├── AverageXPCard
│       └── TopScoreCard
├── LeaderboardContainer
│   ├── LeaderboardList
│   │   └── LeaderboardEntry[]
│   │       ├── RankBadge
│   │       ├── UserAvatar
│   │       ├── UserInfo
│   │       └── MetricDisplay (Points OR GameXP)
│   └── LoadMoreButton
└── LeaderboardPageSkeleton (loading state)
```

### State Management

The component will manage the following state:

```typescript
interface LeaderboardState {
  // Toggle state
  activeLeaderboard: 'points' | 'gameXP';
  
  // Points leaderboard data
  pointsLeaderboard: LeaderboardEntry[];
  pointsLoading: boolean;
  pointsCursor: number | null;
  pointsHasMore: boolean;
  
  // Game XP leaderboard data
  gameXPLeaderboard: LeaderboardEntry[];
  gameXPLoading: boolean;
  gameXPCursor: number | null;
  gameXPHasMore: boolean;
  
  // Shared state
  stakingStats: StakingStats;
  gameStats: GameStats;
  statsLoading: boolean;
  isMobileMenuOpen: boolean;
}

interface LeaderboardEntry {
  wallet_address: string;
  points: number;
  game_score: number;
  isCurrentUser?: boolean;
  originalRank?: number;
}

interface StakingStats {
  totalNFTsStaked: number;
  totalStakers: number;
  tokenHoldersCount: number;
}

interface GameStats {
  totalPlayers: number;
  averageXP: number;
  topScore: number;
}
```

## Components and Interfaces

### 1. StunningToggleSwitcher Component

A visually impressive toggle component that allows switching between leaderboards.

**Design Specifications:**
- Pill-shaped container with rounded corners (rounded-full)
- Sliding indicator that animates smoothly between options
- Gradient backgrounds for active state
- Hover effects with scale transformations
- Smooth transitions (300ms duration)
- Responsive sizing for mobile and desktop

**Visual States:**
- **Active Tab**: Gradient background (purple-to-pink), white text, elevated shadow
- **Inactive Tab**: Transparent background, muted text color
- **Hover State**: Slight scale increase (scale-105), enhanced shadow
- **Transition**: Smooth sliding animation with spring physics

**Implementation Pattern:**
```typescript
<div className="relative inline-flex p-1 rounded-full bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800">
  {/* Sliding indicator */}
  <div className="absolute inset-y-1 transition-all duration-300 ease-out rounded-full bg-gradient-to-r from-purple-600 to-pink-600 shadow-lg" 
       style={{ left: activeTab === 'points' ? '4px' : '50%', width: 'calc(50% - 4px)' }} />
  
  {/* Tab buttons */}
  <button onClick={() => setActiveTab('points')} className="relative z-10 px-6 py-3 rounded-full transition-all">
    <Trophy className="w-5 h-5" />
    <span>Points</span>
  </button>
  <button onClick={() => setActiveTab('gameXP')} className="relative z-10 px-6 py-3 rounded-full transition-all">
    <Gamepad2 className="w-5 h-5" />
    <span>Game XP</span>
  </button>
</div>
```

### 2. Enhanced LeaderboardEntry Component

**Visual Enhancements:**
- Gradient overlays on hover
- Smooth scale transformations
- Enhanced rank badges with icons and gradients
- Pulsing animations for top 3 positions
- Distinctive current user highlighting with border accents

**Rank Badge Styling:**
- **Rank 1**: Gold gradient (yellow-500 to amber-500) + Crown icon + pulsing glow
- **Rank 2**: Silver gradient (gray-400 to slate-500) + Medal icon + subtle glow
- **Rank 3**: Bronze gradient (amber-600 to orange-600) + Award icon + subtle glow
- **Rank 4-10**: Purple star icon with semi-transparent background
- **Rank 11+**: Simple numbered badge with theme-appropriate colors

### 3. Stats Cards Section

**Conditional Rendering:**
- Points Leaderboard → Display staking-related stats
- Game XP Leaderboard → Display game-related stats

**Game Stats Cards Design:**
```typescript
// Total Players Card
{
  icon: Users,
  color: 'blue',
  label: 'Total Players',
  value: gameStats.totalPlayers,
  subtitle: 'Active gamers'
}

// Average XP Card
{
  icon: TrendingUp,
  color: 'green',
  label: 'Average XP',
  value: gameStats.averageXP.toFixed(0),
  subtitle: 'Community average'
}

// Top Score Card
{
  icon: Crown,
  color: 'yellow',
  label: 'Top Score',
  value: gameStats.topScore,
  subtitle: 'Highest achievement'
}
```

### 4. API Integration

**New API Endpoint Structure:**

```typescript
// GET /api/leaderboard/points
// Returns points-sorted leaderboard
interface PointsLeaderboardResponse {
  data: Array<{
    wallet_address: string;
    points: number;
    game_score: number;
  }>;
  hasMore: boolean;
}

// GET /api/leaderboard/game-xp
// Returns game_score-sorted leaderboard
interface GameXPLeaderboardResponse {
  data: Array<{
    wallet_address: string;
    points: number;
    game_score: number;
  }>;
  hasMore: boolean;
}

// GET /api/leaderboard/game-stats
// Returns game-related statistics
interface GameStatsResponse {
  totalPlayers: number;
  averageXP: number;
  topScore: number;
}
```

## Data Models

### Database Queries

**Points Leaderboard Query:**
```sql
SELECT wallet_address, points, game_score
FROM shellies_raffle_users
WHERE points > 0
ORDER BY points DESC, wallet_address ASC
LIMIT ? OFFSET ?
```

**Game XP Leaderboard Query:**
```sql
SELECT wallet_address, points, game_score
FROM shellies_raffle_users
WHERE game_score > 0
ORDER BY game_score DESC, wallet_address ASC
LIMIT ? OFFSET ?
```

**Game Statistics Query:**
```sql
SELECT 
  COUNT(DISTINCT wallet_address) as total_players,
  AVG(game_score) as average_xp,
  MAX(game_score) as top_score
FROM shellies_raffle_users
WHERE game_score > 0
```

### UserService Extensions

Add new methods to the existing UserService class:

```typescript
class UserService {
  // Existing methods...
  
  static async getGameXPLeaderboard(
    limit: number = 50,
    userWallet?: string,
    cursor?: number
  ): Promise<LeaderboardEntry[]> {
    // Query sorted by game_score DESC
  }
  
  static async getGameStats(): Promise<GameStats> {
    // Aggregate game statistics
  }
}
```

## Error Handling

### Loading States

1. **Initial Load**: Display full-page skeleton with animated placeholders
2. **Toggle Switch**: Show smooth transition with fade effect, no skeleton needed (instant switch if data cached)
3. **Pagination**: Display loading spinner on "Load More" button
4. **Stats Refresh**: Update stats silently without disrupting UI

### Error States

1. **Network Failure**: Display retry button with error message
2. **Empty Leaderboard**: Show empty state with encouraging message and icon
3. **Partial Data Load**: Display available data with warning indicator
4. **Stats Fetch Failure**: Keep displaying previous stats, log error silently

### Error Recovery

```typescript
const handleLeaderboardError = (error: Error, type: 'points' | 'gameXP') => {
  console.error(`Error fetching ${type} leaderboard:`, error);
  
  // Show user-friendly error message
  toast.error(`Unable to load ${type} leaderboard. Please try again.`);
  
  // Keep previous data if available
  if (type === 'points' && pointsLeaderboard.length > 0) {
    // Keep existing data
  } else {
    // Show empty state
  }
};
```

## Testing Strategy

### Unit Tests

1. **Toggle Switcher Logic**
   - Test state changes when clicking tabs
   - Verify correct leaderboard data is displayed
   - Test animation trigger conditions

2. **Data Fetching**
   - Mock API responses for both leaderboard types
   - Test cursor-based pagination logic
   - Verify user highlighting logic

3. **Stats Calculation**
   - Test game statistics aggregation
   - Verify staking statistics display logic
   - Test conditional rendering of stats cards

### Integration Tests

1. **Leaderboard Switching**
   - Test full flow of switching between leaderboards
   - Verify data persistence when switching back
   - Test loading states during transitions

2. **User Highlighting**
   - Test current user detection in both leaderboards
   - Verify highlighting persists across switches
   - Test with user at different rank positions

3. **Pagination**
   - Test "Load More" functionality for both leaderboards
   - Verify cursor updates correctly
   - Test hasMore flag behavior

### Visual Regression Tests

1. **Toggle Switcher Animations**
   - Capture screenshots of toggle states
   - Verify smooth transitions
   - Test responsive behavior

2. **Leaderboard Styling**
   - Test rank badge variations
   - Verify gradient applications
   - Test dark/light theme consistency

3. **Stats Cards**
   - Test conditional rendering
   - Verify icon and color schemes
   - Test responsive layouts

## Performance Considerations

### Optimization Strategies

1. **Data Caching**
   - Cache previously loaded leaderboard data
   - Implement stale-while-revalidate pattern
   - Clear cache on manual refresh

2. **Lazy Loading**
   - Load only visible leaderboard data initially
   - Fetch alternate leaderboard on first switch
   - Implement virtual scrolling for large lists (future enhancement)

3. **Animation Performance**
   - Use CSS transforms for animations (GPU-accelerated)
   - Implement will-change hints for animated elements
   - Debounce rapid toggle switches

4. **API Optimization**
   - Implement request deduplication
   - Use cursor-based pagination to reduce query complexity
   - Add database indexes on points and game_score columns

### Performance Metrics

- **Initial Load**: < 1 second for first 50 entries
- **Toggle Switch**: < 300ms transition (instant if cached)
- **Pagination**: < 500ms for additional 50 entries
- **Stats Refresh**: < 200ms (background operation)

## Accessibility

1. **Keyboard Navigation**
   - Tab key navigates between toggle options
   - Enter/Space activates selected toggle
   - Arrow keys navigate leaderboard entries

2. **Screen Reader Support**
   - ARIA labels for toggle switcher
   - Announce leaderboard changes
   - Describe rank positions and metrics

3. **Visual Accessibility**
   - Maintain WCAG AA contrast ratios
   - Provide text alternatives for icons
   - Support reduced motion preferences

## Migration Path

### Phase 1: Backend Updates
1. Create new API endpoints for game XP leaderboard
2. Add game statistics endpoint
3. Update UserService with new methods
4. Add database indexes for performance

### Phase 2: Frontend Components
1. Create StunningToggleSwitcher component
2. Update LeaderboardPage state management
3. Implement conditional stats rendering
4. Add new loading states

### Phase 3: Visual Enhancements
1. Apply new styling to toggle switcher
2. Enhance rank badges and animations
3. Update stats cards design
4. Implement smooth transitions

### Phase 4: Testing & Polish
1. Add unit and integration tests
2. Perform visual regression testing
3. Optimize performance
4. Gather user feedback and iterate
