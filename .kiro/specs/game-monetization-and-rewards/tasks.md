# Implementation Plan

- [x] 1. Write GamePaymentContract Solidity smart contract





  - [x] 1.1 Create contract structure


    - Create GamePaymentContract.sol in contracts directory
    - Add SPDX license and pragma solidity ^0.8.20
    - Define state variables (owner, totalCollected, PAYMENT_AMOUNT)
    - Add constructor to set owner as msg.sender on deployment
    - Create onlyOwner modifier for access control
    - _Requirements: 1.1, 1.2, 1.7_

  - [x] 1.2 Implement payToPlay function


    - Create payToPlay payable function
    - Validate msg.value >= PAYMENT_AMOUNT with require statement
    - Update totalCollected counter
    - Emit PaymentReceived event with player address, amount, and timestamp
    - _Requirements: 1.1, 1.3_



  - [x] 1.3 Implement withdraw function with owner access control





    - Create withdraw function with onlyOwner modifier
    - Check contract balance > 0 with require statement
    - Transfer all ETH to owner using call with proper error handling
    - Emit FundsWithdrawn event with amount and timestamp


    - _Requirements: 1.4, 1.6_

  - [x] 1.4 Add view functions and events




    - Implement getBalance view function that returns address(this).balance
    - Define PaymentReceived event (indexed player, amount, timestamp)
    - Define FundsWithdrawn event (indexed owner, amount, timestamp)
    - Add comments explaining each function
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.7_

- [x] 2. Create price oracle service for ETH/USD conversion





  - Implement PriceOracle class in src/lib/price-oracle.ts
  - Add getEthPrice method that fetches from CoinGecko API
  - Implement 5-minute caching mechanism for price data
  - Add calculateRequiredEth method for USD to ETH conversion
  - Include fallback price (2500 USD) for API failures
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.7_


- [x] 3. Configure Ink network in wagmi setup





  - Define Ink network chain configuration in wagmi config file
  - Add Ink network details (chain ID 57073, RPC URL, block explorer)
  - Ensure Ink network is available in wallet connection options
  - Test network switching to Ink in RainbowKit modal
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 4. Create contract configuration and ABI





  - Create src/lib/contracts.ts file
  - Define GAME_PAYMENT_CONTRACT constant with address and ABI
  - Export contract ABI with payToPlay, withdraw, getBalance, and owner functions
  - Add environment variable for contract address (NEXT_PUBLIC_GAME_PAYMENT_CONTRACT)
  - Create GamePaymentService utility class with helper methods
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 5. Create useGamePayment hook for payment state management





  - [x] 5.1 Implement session storage management


    - Create PaymentSession interface for session data structure
    - Add checkPaymentStatus method that reads from sessionStorage
    - Implement storePaymentSession method to save payment confirmation
    - Add clearPaymentSession method for game over events
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 5.2 Implement payment flow logic with wagmi


    - Create useGamePayment hook in src/hooks/useGamePayment.ts
    - Add state for hasActivePayment, paymentLoading, paymentError
    - Fetch ETH price using PriceOracle on mount
    - Use wagmi's useWriteContract hook for payToPlay function call
    - Use useWaitForTransactionReceipt for transaction confirmation
    - Add postMessage listener for GAME_OVER event to clear session
    - Calculate required ETH in wei using parseEther
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 9.1, 9.2, 9.3, 9.4, 9.5_
- [x] 6. Build PaymentModal component




- [ ] 6. Build PaymentModal component

  - Create PaymentModal component in src/components/PaymentModal.tsx
  - Display USD amount (0.04) and calculated ETH amount
  - Show payment status states (idle, pending, confirming, success, error)
  - Implement "Pay to Play" button that triggers wagmi writeContract
  - Add transaction hash display and Ink explorer link
  - Style with purple/pink gradient theme and framer-motion animations
  - Handle wallet connection errors and insufficient balance errors
  - Add network check and switch to Ink network if needed
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 10.6, 10.7_
-

- [x] 7. Integrate payment system into game page




  - Update src/app/portal/game/page.tsx to use useGamePayment hook
  - Add payment status check before rendering MarioGameConsoleV2
  - Show PaymentModal when hasActivePayment is false
  - Pass onPaymentSuccess callback to close modal and start game
  - Add loading state while checking payment status
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 9.1, 9.2, 9.3_

- [x] 8. Update game console to handle payment session lifecycle





  - Modify MarioGameConsoleV2 to listen for GAME_OVER postMessage
  - Call clearPaymentSession from useGamePayment on game over
  - Add payment required indicator when session expires
  - Test payment persistence across page refreshes
  - _Requirements: 2.6, 9.4, 9.5_

- [x] 9. Create XP to Points conversion API endpoint





  - Create POST endpoint at src/app/api/bridge/convert-xp/route.ts
  - Define ConvertXPRequest and ConvertXPResponse interfaces
  - Validate walletAddress and xpAmount from request body
  - Query shellies_raffle_users table for current user data
  - Verify user has sufficient game_score for conversion
  - Calculate points using conversion rate (xpAmount / 10)
  - Execute atomic UPDATE query to subtract XP and add points
  - Return updated balances (newXP, newPoints, pointsAdded)
  - Handle errors: insufficient XP (400), user not found (404), database errors (500)
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10_

- [x] 10. Build XPBridge component with conversion logic





  - [x] 10.1 Create component structure and state management


    - Create XPBridge component in src/components/XPBridge.tsx
    - Add props for currentXP, currentPoints, onConversionComplete
    - Implement state for xpInput, calculatedPoints, isConverting, conversionError
    - Define CONVERSION_RATE constant (10 for 1000 XP = 100 points)
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 10.2 Implement input validation and calculation


    - Add onChange handler for XP input field
    - Calculate points in real-time as user types (xpInput / 10)
    - Validate that xpInput is positive integer
    - Check that user has sufficient XP balance
    - Display error message for invalid amounts
    - Disable convert button when validation fails
    - _Requirements: 5.4, 5.5, 5.6, 5.7_

  - [x] 10.3 Implement conversion API integration


    - Create handleConvert function that calls /api/bridge/convert-xp
    - Pass walletAddress and xpAmount in request body
    - Handle success response and call onConversionComplete callback
    - Handle error responses and display appropriate messages
    - Set isConverting state during API call
    - _Requirements: 5.8, 5.9, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10_


- [x] 11. Create animated particle effect for XP conversion



  - [x] 11.1 Build particle animation system


    - Create particle array with 20 particles
    - Calculate start position from XP container ref
    - Calculate end position from points container ref
    - Use framer-motion for particle movement animation
    - Add staggered delay (0.05s per particle) for wave effect
    - Set animation duration to 1.5 seconds with easeInOut easing
    - _Requirements: 6.1, 6.2, 6.3, 6.6_

  - [x] 11.2 Integrate animation with conversion flow


    - Trigger animation on convert button click
    - Disable convert button during animation (isConverting state)
    - Show animation before calling API
    - Update displayed XP and points values after animation completes
    - Display success message with checkmark after animation
    - _Requirements: 6.1, 6.4, 6.5, 6.7, 6.8_

- [x] 12. Style XPBridge component with responsive design




  - Create card-based layout with gradient background
  - Design separate containers for XP and points display
  - Add prominent conversion rate display (1000 XP = 100 points)
  - Style input field with validation states (error/success)
  - Add convert button with hover and disabled states
  - Implement success message animation
  - Ensure mobile responsiveness for all screen sizes
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 6.8_
-

- [x] 13. Update frontend terminology from "Score" to "XP"




  - [x] 13.1 Create formatting utility functions

    - Create src/lib/format-utils.ts file
    - Implement formatXP function that returns "{number} XP" with locale formatting
    - Implement formatPoints function for consistent points display
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_


  - [x] 13.2 Update profile page XP display

    - Modify src/app/portal/profile/page.tsx
    - Change "Game Score" label to "XP"
    - Use formatXP utility for displaying game_score value
    - Update tooltips and descriptions to use "XP" terminology
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_



  - [x] 13.3 Update game page XP display


    - Modify src/app/portal/game/page.tsx and MarioGameConsoleV2 component
    - Change score labels to "XP"
    - Update "XP earned" messages in game events
    - Use formatXP for all score displays
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 13.4 Update leaderboard XP column

    - Modify leaderboard page component
    - Change "Score" column header to "XP"
    - Use formatXP for displaying user scores
    - Ensure sorting still works correctly
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 14. Integrate XPBridge into profile page





  - Add XPBridge component to src/app/portal/profile/page.tsx
  - Create dedicated "XP Bridge" section with visual distinction
  - Pass currentXP (user.game_score) and currentPoints (user.points) as props
  - Implement onConversionComplete callback to refresh user data
  - Position bridge section prominently on profile page
  - Add loading states while fetching user data
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

- [x] 15. Create admin withdrawal interface




  - [x] 15.1 Build admin withdrawal page


    - Create src/app/admin/withdrawals/page.tsx
    - Add access control check for owner wallet address
    - Redirect non-owners to portal with error message
    - Use environment variable for owner address comparison
    - _Requirements: 3.1, 3.2_

  - [x] 15.2 Implement balance display and withdrawal flow with wagmi

    - Use wagmi's useReadContract to fetch contract balance
    - Display balance in ETH and USD equivalent
    - Add auto-refresh every 30 seconds for balance updates
    - Use wagmi's useWriteContract for withdraw function
    - Show withdrawal confirmation modal before executing
    - Use useWaitForTransactionReceipt for transaction confirmation
    - Display transaction status (pending, success, error)
    - Show transaction hash with link to Ink explorer
    - Refresh balance after successful withdrawal
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_


- [x] 16. Add comprehensive error handling across all features




  - Implement payment error messages (insufficient balance, transaction failed, user rejected, network error)
  - Add conversion error messages (insufficient XP, invalid amount, database error, network error)
  - Create user-friendly error display components
  - Add retry mechanisms for failed transactions
  - Log errors to console for debugging
  - _Requirements: 2.8, 7.8, 7.9, 7.10_

- [x] 17. Write integration tests for payment and conversion flows






  - Test payment modal interaction and transaction flow
  - Test XP bridge input validation and calculation
  - Test conversion API endpoint with various scenarios
  - Test admin withdrawal access control and flow
  - Test error handling for all failure scenarios
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10_



