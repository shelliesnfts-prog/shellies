# Requirements Document

## Introduction

This document outlines the requirements for adding monetization and reward conversion features to the Shellies Game. The system introduces a pay-to-play mechanism using a Solana smart contract where users pay 0.04 USD equivalent in ETH to play, and a bridge feature that allows users to convert their game experience points (XP) to raffle points with an animated UI. The integration maintains the existing game functionality while adding these new economic layers.

## Glossary

- **Pay-to-Play System**: The smart contract and frontend integration that requires users to pay 0.04 USD in ETH before playing the game
- **Game Payment Contract**: The Solidity smart contract deployed on Ink network that handles game entry payments and owner withdrawals
- **XP (Experience Points)**: The renamed game_score field, representing points earned through gameplay (displayed as "XP" in the frontend)
- **Raffle Points**: The points currency used to enter raffles, stored in the user's profile
- **XP Bridge**: The feature that converts XP to raffle points at a rate of 1000 XP = 100 points
- **Bridge Animation**: The visual effect showing points transferring from the XP container to the points container
- **Owner Wallet**: The designated wallet address that can withdraw collected ETH from the Game Payment Contract
- **Game Session**: A single playthrough of the game from start until game over

## Requirements

### Requirement 1: Game Payment Smart Contract

**User Story:** As the platform owner, I want a Solidity smart contract on Ink network that collects game entry fees and allows me to withdraw funds, so that I can monetize the game platform.

#### Acceptance Criteria

1. THE Game Payment Contract SHALL accept payments of 0.04 USD equivalent in ETH per game session
2. THE Game Payment Contract SHALL store the owner wallet address that is authorized to withdraw funds
3. THE Game Payment Contract SHALL provide a `payToPlay` function that accepts payment and validates the amount
4. THE Game Payment Contract SHALL provide a `withdraw` function that transfers all collected ETH to the owner wallet
5. THE Game Payment Contract SHALL emit events for successful payments and withdrawals for tracking purposes
6. WHEN the `withdraw` function is called by a non-owner address, THE Game Payment Contract SHALL reject the transaction
7. THE Game Payment Contract SHALL maintain an accurate balance of collected funds

### Requirement 2: Payment Integration on Game Portal

**User Story:** As a player, I want to pay to play the game, so that I can access the gameplay experience.

#### Acceptance Criteria

1. WHEN a user clicks the play button or starts a game session, THE Pay-to-Play System SHALL check if payment has been made for the current session
2. IF payment has not been made, THE Pay-to-Play System SHALL display a payment modal with the cost (0.04 USD in ETH)
3. THE Pay-to-Play System SHALL calculate the current ETH equivalent of 0.04 USD using a price oracle or API
4. WHEN a user confirms payment, THE Pay-to-Play System SHALL call the Game Payment Contract's `payToPlay` function
5. WHEN the payment transaction is confirmed, THE Pay-to-Play System SHALL allow the game to start
6. WHEN a user loses the game (game over), THE Pay-to-Play System SHALL require a new payment to play again
7. THE Pay-to-Play System SHALL display transaction status (pending, confirmed, failed) to the user
8. IF a payment transaction fails, THE Pay-to-Play System SHALL display an error message and allow the user to retry

### Requirement 3: Owner Withdrawal Interface

**User Story:** As the platform owner, I want to withdraw collected ETH from the game contract, so that I can access the revenue.

#### Acceptance Criteria

1. THE Pay-to-Play System SHALL provide an admin interface accessible only to the owner wallet
2. THE admin interface SHALL display the current contract balance in ETH and USD equivalent
3. THE admin interface SHALL provide a "Withdraw" button that calls the contract's `withdraw` function
4. WHEN the owner clicks withdraw, THE Pay-to-Play System SHALL initiate the withdrawal transaction
5. WHEN the withdrawal is successful, THE Pay-to-Play System SHALL display a success message with the transaction hash
6. THE Pay-to-Play System SHALL update the displayed balance after successful withdrawal
7. IF the withdrawal fails, THE Pay-to-Play System SHALL display an error message with details

### Requirement 4: XP Display Rename

**User Story:** As a player, I want to see my game score labeled as "XP" throughout the interface, so that the terminology is consistent and clear.

#### Acceptance Criteria

1. THE Game System SHALL display "XP" instead of "game score" or "score" in all user-facing text
2. THE Game System SHALL use "XP" in the profile page, game page, and leaderboard
3. THE Game System SHALL maintain the backend field name as `game_score` in the database
4. THE Game System SHALL use "XP" in tooltips, labels, and descriptions
5. THE Game System SHALL display XP values with appropriate formatting (e.g., "1,250 XP")

### Requirement 5: XP to Points Bridge Feature

**User Story:** As a player, I want to convert my XP to raffle points, so that I can use my gameplay achievements to enter raffles.

#### Acceptance Criteria

1. THE XP Bridge SHALL be accessible from the profile page
2. THE XP Bridge SHALL display the user's current XP balance and current raffle points balance
3. THE XP Bridge SHALL display the conversion rate (1000 XP = 100 points) prominently
4. THE XP Bridge SHALL provide an input field where users can enter the amount of XP to convert
5. THE XP Bridge SHALL calculate and display the resulting points amount in real-time as the user types
6. THE XP Bridge SHALL validate that the user has sufficient XP for the conversion
7. WHEN a user enters an amount greater than their XP balance, THE XP Bridge SHALL display an error message
8. THE XP Bridge SHALL provide a "Convert" button that initiates the conversion process
9. WHEN the conversion is successful, THE XP Bridge SHALL update both XP and points balances in the database

### Requirement 6: Bridge Conversion Animation

**User Story:** As a player, I want to see a smooth animation when converting XP to points, so that the conversion feels satisfying and clear.

#### Acceptance Criteria

1. WHEN a user clicks the Convert button, THE XP Bridge SHALL trigger an animation sequence
2. THE animation SHALL show visual elements (particles, icons, or numbers) moving from the XP container to the points container
3. THE animation SHALL last between 1-2 seconds for optimal user experience
4. DURING the animation, THE XP Bridge SHALL disable the convert button to prevent duplicate conversions
5. THE animation SHALL use smooth easing functions for natural motion
6. WHEN the animation completes, THE XP Bridge SHALL update the displayed XP and points values
7. THE XP Bridge SHALL display a success message after the animation completes
8. THE animation SHALL be responsive and work on mobile devices

### Requirement 7: Bridge API Endpoint

**User Story:** As a developer, I want an API endpoint for XP to points conversion, so that the bridge feature can persist changes to the database.

#### Acceptance Criteria

1. THE XP Bridge SHALL provide a POST endpoint at `/api/bridge/convert-xp`
2. THE endpoint SHALL accept `walletAddress` and `xpAmount` in the request body
3. THE endpoint SHALL validate that the user has sufficient XP for the conversion
4. THE endpoint SHALL calculate the points amount using the conversion rate (1000 XP = 100 points)
5. THE endpoint SHALL update the user's `game_score` by subtracting the converted XP
6. THE endpoint SHALL update the user's `points` by adding the calculated points
7. THE endpoint SHALL perform both updates in a single database transaction to ensure consistency
8. IF the user has insufficient XP, THE endpoint SHALL return a 400 error with an appropriate message
9. THE endpoint SHALL return the updated XP and points balances on success
10. THE endpoint SHALL handle database errors gracefully and return appropriate error responses

### Requirement 8: Profile Page Bridge Integration

**User Story:** As a player, I want to access the XP bridge from my profile page, so that I can easily convert my XP when viewing my stats.

#### Acceptance Criteria

1. THE Profile Page SHALL display a dedicated "XP Bridge" section or card
2. THE XP Bridge section SHALL be visually distinct from other profile sections
3. THE XP Bridge section SHALL display current XP balance with the "XP" label
4. THE XP Bridge section SHALL display current raffle points balance
5. THE XP Bridge section SHALL include the conversion interface (input, rate display, convert button)
6. THE XP Bridge section SHALL be positioned prominently on the profile page for easy access
7. THE Profile Page SHALL refresh XP and points displays after successful conversion

### Requirement 9: Payment Session Management

**User Story:** As a player, I want my payment to be valid for my current game session, so that I don't have to pay multiple times if I refresh the page.

#### Acceptance Criteria

1. THE Pay-to-Play System SHALL track payment status for the current game session
2. THE Pay-to-Play System SHALL store payment confirmation in session storage or state
3. WHEN a user refreshes the page during an active session, THE Pay-to-Play System SHALL check if payment was already made
4. WHEN a game over event occurs, THE Pay-to-Play System SHALL clear the payment session
5. THE Pay-to-Play System SHALL require new payment only after game over, not on page refresh

### Requirement 10: Price Oracle Integration

**User Story:** As a player, I want to pay the correct ETH amount equivalent to 0.04 USD, so that the payment is fair regardless of ETH price fluctuations.

#### Acceptance Criteria

1. THE Pay-to-Play System SHALL integrate with a price oracle or API to get current ETH/USD price
2. THE Pay-to-Play System SHALL calculate the required ETH amount based on the current price
3. THE Pay-to-Play System SHALL update the displayed ETH amount when the price changes significantly
4. THE Pay-to-Play System SHALL cache the price for a reasonable duration (e.g., 5 minutes) to reduce API calls
5. IF the price oracle is unavailable, THE Pay-to-Play System SHALL use a fallback price or display an error message
6. THE Pay-to-Play System SHALL display both the USD amount (0.04) and the calculated ETH amount to the user
7. THE Pay-to-Play System SHALL work with Ink network's native ETH

