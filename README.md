# Shellies Raffles

A decentralized raffle and staking platform built for Shellies NFT holders on the Ink blockchain. Users can participate in raffles using their earned points to win NFTs and ERC20 tokens.

## Overview

Shellies Raffles is a Next.js 15 application that enables NFT-based raffles with point-driven participation. Built specifically for the Shellies NFT community, it features blockchain integration for secure raffle management and prize distribution.

## Key Features

- **Point-Based Participation**: Users earn points through NFT ownership and can spend them on raffle tickets
- **Multi-Prize Support**: Raffles can feature NFT or ERC20 token prizes
- **Blockchain Integration**: Smart contracts handle raffle creation, participation, and winner selection
- **Staking System**: NFT holders can stake their tokens for additional benefits
- **Admin Dashboard**: Complete raffle management interface for administrators
- **Wallet Authentication**: SIWE (Sign-In With Ethereum) for secure wallet-based authentication

## Smart Contracts

The platform integrates with two main smart contracts on the Ink blockchain (Chain ID: 57073):

### Raffle Contract
- **Purpose**: Manages the complete raffle lifecycle from creation to prize distribution
- **Key Functions**:
  - `createAndActivateNFTRaffle()` - Creates raffles with NFT prizes
  - `createAndActivateTokenRaffle()` - Creates raffles with ERC20 token prizes
  - `endRaffle()` - Concludes raffles and selects winners
  - `getRaffleInfo()` - Retrieves raffle details and status
- **Features**: Role-based access control, emergency withdrawal, pausable functionality

### Staking Contract
- **Purpose**: Allows Shellies NFT holders to stake their tokens with time-lock periods
- **Key Functions**:
  - `stake()` / `stakeBatch()` - Stake single or multiple NFTs
  - `unstake()` / `unstakeBatch()` - Unstake tokens after lock period
  - `canUnstake()` - Check if tokens can be unstaked
  - `getStakedTokens()` - View user's staked NFTs
- **Features**: Multiple lock periods (day, week, month), emergency unstaking

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS v4
- **Blockchain**: Wagmi, Viem, RainbowKit for Web3 integration
- **Authentication**: NextAuth with SIWE
- **Database**: Supabase (PostgreSQL)
- **Animations**: Framer Motion, GSAP, Three.js
- **Testing**: Jest

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables (see Environment Variables section)

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Development Commands

- `npm run dev` - Start development server
- `npm run build` - Build production application
- `npm start` - Start production server
- `npm test` - Run Jest tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:points` - Run points logic tests

## Project Structure

- `/src/app` - Next.js app router pages and API routes
- `/src/components` - React components
- `/src/lib` - Core utilities, database, and blockchain integration
- `/src/lib/raffle-contract.ts` - Raffle smart contract integration
- `/src/lib/staking-abi.ts` - Staking contract ABI and utilities
