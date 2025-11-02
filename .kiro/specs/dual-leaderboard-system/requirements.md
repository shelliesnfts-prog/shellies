# Requirements Document

## Introduction

This feature transforms the existing single leaderboard into a dual-leaderboard system that separates Game XP rankings from Points rankings. Users will be able to switch between the two leaderboards using a visually stunning toggle switcher. The overall leaderboard design will be enhanced with modern, eye-catching UI elements that create an engaging competitive experience.

## Glossary

- **Leaderboard System**: The component that displays ranked user data based on specific metrics
- **Game XP Leaderboard**: A ranking display showing users sorted by their game experience points (game_score)
- **Points Leaderboard**: A ranking display showing users sorted by their accumulated points from staking and other activities
- **Toggle Switcher**: An interactive UI control that allows users to switch between the two leaderboard views
- **User Session**: The authenticated state containing the connected wallet address
- **Rank Badge**: A visual indicator showing a user's position in the leaderboard
- **Current User Highlight**: Visual emphasis applied to the authenticated user's entry in the leaderboard

## Requirements

### Requirement 1

**User Story:** As a user, I want to view separate leaderboards for Game XP and Points, so that I can see rankings for each metric independently

#### Acceptance Criteria

1. WHEN the user navigates to the leaderboard page, THE Leaderboard System SHALL display the Points Leaderboard by default
2. THE Leaderboard System SHALL maintain separate data fetching logic for Game XP rankings and Points rankings
3. WHEN displaying the Game XP Leaderboard, THE Leaderboard System SHALL sort users by game_score in descending order
4. WHEN displaying the Points Leaderboard, THE Leaderboard System SHALL sort users by points in descending order
5. THE Leaderboard System SHALL display only one leaderboard view at a time based on the active toggle selection

### Requirement 2

**User Story:** As a user, I want to switch between Game XP and Points leaderboards using a stunning toggle, so that I can easily compare different ranking metrics

#### Acceptance Criteria

1. THE Toggle Switcher SHALL be positioned prominently at the top of the leaderboard section
2. THE Toggle Switcher SHALL display two clearly labeled options: "Game XP" and "Points"
3. WHEN the user clicks on a toggle option, THE Leaderboard System SHALL transition to the corresponding leaderboard view within 300 milliseconds
4. THE Toggle Switcher SHALL provide visual feedback indicating which leaderboard is currently active
5. THE Toggle Switcher SHALL feature smooth animations and gradient effects that align with the application's design system

### Requirement 3

**User Story:** As a user, I want the leaderboard to have a stunning visual design, so that the competitive experience feels engaging and premium

#### Acceptance Criteria

1. THE Leaderboard System SHALL apply gradient backgrounds and shadow effects to create visual depth
2. THE Rank Badge SHALL display distinct visual treatments for top 3 positions using crown, medal, and award icons
3. WHEN a user entry is hovered, THE Leaderboard System SHALL apply smooth scale and shadow transitions within 200 milliseconds
4. THE Leaderboard System SHALL use consistent color schemes that adapt to both light and dark themes
5. THE Current User Highlight SHALL apply a distinctive gradient background with border accent to make the user's entry stand out

### Requirement 4

**User Story:** As a user, I want to see my ranking in both leaderboards, so that I can track my performance across different metrics

#### Acceptance Criteria

1. WHEN the User Session contains a wallet address, THE Leaderboard System SHALL highlight the current user's entry in both leaderboards
2. THE Leaderboard System SHALL display a "You" badge on the current user's entry in the active leaderboard view
3. WHEN switching between leaderboards, THE Leaderboard System SHALL maintain the current user's highlighted state
4. THE Leaderboard System SHALL preserve the user's actual rank position without artificially moving their entry
5. IF the current user is not in the visible portion of the leaderboard, THE Leaderboard System SHALL allow pagination to locate their entry

### Requirement 5

**User Story:** As a user, I want the leaderboard to load efficiently, so that I can view rankings without delays

#### Acceptance Criteria

1. THE Leaderboard System SHALL implement cursor-based pagination with a page size of 50 entries
2. WHEN switching between leaderboards, THE Leaderboard System SHALL display a loading skeleton during data fetching
3. THE Leaderboard System SHALL cache the previously viewed leaderboard data to enable instant switching back
4. WHEN the user scrolls to the bottom, THE Leaderboard System SHALL provide a "Load More" button to fetch additional entries
5. THE Leaderboard System SHALL display loading indicators that match the overall design aesthetic

### Requirement 6

**User Story:** As a user, I want to see relevant statistics for each leaderboard type, so that I understand the context of the rankings

#### Acceptance Criteria

1. WHEN viewing the Points Leaderboard, THE Leaderboard System SHALL display staking statistics including total NFTs staked, token holders, and total stakers
2. WHEN viewing the Game XP Leaderboard, THE Leaderboard System SHALL display game-related statistics such as total players and average XP
3. THE Leaderboard System SHALL update statistics independently from leaderboard data fetching
4. THE Leaderboard System SHALL display statistics in visually distinct card components with icons and gradient backgrounds
5. THE Leaderboard System SHALL refresh statistics every 30 seconds without disrupting the user's viewing experience
