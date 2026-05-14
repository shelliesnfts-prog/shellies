# Dynamic Payment Amount Implementation Summary

## Overview
Implemented dynamic pay-to-play amount functionality allowing the contract owner to update the payment amount instead of having it fixed in the contract. Added ETH/USD converter for easy amount management.

## Changes Made

### 1. Smart Contract Updates (`contracts/GamePaymentContract.sol`)
- Changed `PAYMENT_AMOUNT` from constant to dynamic `paymentAmount` state variable
- Added `updatePaymentAmount(uint256 newAmount)` function (owner-only)
- Added `getPaymentAmount()` view function to read current amount
- Added `PaymentAmountUpdated` event for tracking changes
- Initialized payment amount to 0.00001 ETH in constructor

### 2. Contract ABI Updates (`src/lib/contracts.ts`)
- Added `paymentAmount` state variable to ABI
- Added `getPaymentAmount()` function to ABI
- Added `updatePaymentAmount(uint256)` function to ABI
- Added `PaymentAmountUpdated` event to ABI
- Removed deprecated `PAYMENT_AMOUNT` constant

### 3. ETH/USD Converter Component (`src/components/EthUsdConverter.tsx`)
- New component for converting between ETH and USD
- Real-time ETH price fetching from PriceOracle
- Bidirectional conversion (USD to ETH and ETH to USD)
- Refresh button to update ETH price
- Returns bigint ETH amount via callback for contract interaction

### 4. Admin Withdrawal Page Updates (`src/app/admin/withdrawals/page.tsx`)
- Added "Payment Amount Settings" card showing current payment amount
- Displays current amount in both ETH and USD
- "Update Payment Amount" button opens modal with converter
- Modal includes:
  - ETH/USD converter for easy amount calculation
  - Transaction status tracking
  - Success/error feedback
  - Link to Ink Explorer for transaction verification
- Auto-refreshes payment amount after successful update
- Added transaction hooks for update amount functionality

### 5. Game Payment Hook Updates (`src/hooks/useGamePayment.ts`)
- Added `useReadContract` to fetch dynamic payment amount from contract
- Removed hardcoded USD amount calculation
- Now reads `getPaymentAmount()` from contract
- Updates `requiredEth` state when contract amount changes
- Maintains backward compatibility with existing payment flow

### 6. Payment Modal Updates (`src/components/PaymentModal.tsx`)
- Made `usdAmount` prop optional
- Added `ethPrice` prop for dynamic USD calculation
- Calculates USD amount from ETH price if provided
- Shows ETH price in the modal
- Displays amount with 8 decimal precision for accuracy
- Shows calculated USD value based on current ETH price

### 7. Game Page Updates (`src/app/portal/game/page.tsx`)
- Passes `ethPrice` to PaymentModal
- Removed hardcoded `usdAmount` prop
- Modal now shows dynamic amount from contract

## Features

### For Admin (Withdrawal Page)
1. **View Current Payment Amount**: See the current pay-to-play amount in ETH and USD
2. **ETH/USD Converter**: Convert between USD and ETH using real-time prices
3. **Update Amount**: Set new payment amount with one-click transaction
4. **Transaction Tracking**: Monitor update transaction status
5. **Explorer Links**: View transactions on Ink Explorer

### For Players (Game Page)
1. **Dynamic Amount Display**: See current payment amount in ETH
2. **USD Equivalent**: View USD value based on current ETH price
3. **Real-time Pricing**: Amount updates automatically when contract is updated
4. **Transparent Pricing**: ETH price shown in modal for transparency

## Usage

### Admin: Update Payment Amount
1. Navigate to Admin → Withdrawals page
2. View current payment amount in "Payment Amount Settings" card
3. Click "Update Payment Amount" button
4. Use ETH/USD converter to calculate desired amount
   - Enter USD amount (e.g., 0.04) to get ETH equivalent
   - Or enter ETH amount directly
5. Click "Update Amount" to submit transaction
6. Sign transaction in wallet
7. Wait for confirmation
8. New amount is now active for all players

### Players: Pay to Play
1. Navigate to Game page
2. Payment modal shows current amount in ETH
3. USD equivalent displayed based on current ETH price
4. Click "Pay to Play" to proceed
5. Amount charged is the current contract amount

## Technical Details

### Contract Functions
```solidity
// Read current payment amount
function getPaymentAmount() external view returns (uint256)

// Update payment amount (owner only)
function updatePaymentAmount(uint256 newAmount) external onlyOwner

// Pay to play with current amount
function payToPlay() external payable
```

### Events
```solidity
event PaymentAmountUpdated(uint256 oldAmount, uint256 newAmount, uint256 timestamp)
```

## Security Considerations
- Only contract owner can update payment amount
- Amount must be greater than 0
- All updates are logged via events
- Transaction verification via Ink Explorer
- Server-side session validation remains unchanged

## Next Steps
1. Deploy updated contract to Ink network
2. Update environment variables with new contract address
3. Test payment amount updates on testnet
4. Verify USD/ETH conversion accuracy
5. Monitor gas costs for update transactions

## Notes
- ETH price fetched from PriceOracle (CoinGecko API)
- Converter updates in real-time
- All amounts stored in wei (18 decimals)
- UI shows 8 decimal places for precision
- Backward compatible with existing payment flow
