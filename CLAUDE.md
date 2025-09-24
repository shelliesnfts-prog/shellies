# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run dev` - Start the development server (Next.js)
- `npm run build` - Build the production application
- `npm start` - Start the production server
- `npm test` - Run all tests with Jest
- `npm run test:watch` - Run tests in watch mode
- `npm run test:points` - Run specific points logic tests

## Architecture Overview

This is a Next.js 15 application for NFT raffles on the Ink blockchain, specifically for Shellies NFT holders. The architecture follows these key patterns:

### Tech Stack
- **Frontend**: Next.js 15 (App Router), React 19, TypeScript
- **Authentication**: NextAuth with SIWE (Sign-In With Ethereum) 
- **Blockchain**: Wagmi, Viem, RainbowKit for Web3 integration
- **Database**: Supabase (PostgreSQL with RLS)
- **Styling**: Tailwind CSS v4
- **Testing**: Jest with Node environment
- **Animations**: Framer Motion, GSAP, Three.js

### Project Structure

**API Routes** (`src/app/api/`):
- Authentication: `/auth/[...nextauth]` - SIWE-based wallet authentication
- User management: `/user`, `/dashboard`, `/leaderboard`
- Raffle system: `/raffles`, `/raffle-entries/[raffleId]`, `/raffle-entries/enter`
- Admin endpoints: `/admin/raffles`, `/admin/entries`, `/admin/users`, `/admin/check`
- Staking system: `/claim-staking`
- Debug tools: `/debug/contract`

**Frontend Pages** (`src/app/`):
- Landing: `/` - Main landing page
- Portal: `/portal` - Main user dashboard with nested routes:
  - `/portal/raffles` - View and enter raffles
  - `/portal/profile` - User profile and points
  - `/portal/leaderboard` - Points leaderboard
  - `/portal/staking` - Staking interface
  - `/portal/trade` - Trading interface
- Admin: `/admin` - Admin dashboard for raffle management

**Core Libraries** (`src/lib/`):
- `supabase.ts` - Database client configuration and type definitions
- `auth.ts` - NextAuth configuration with SIWE provider
- `wagmi.ts` - Web3 configuration for Ink chain (chain ID: 57073)
- `raffle-contract.ts` & `raffle-abi.ts` - Smart contract integration
- `staking-service.ts` & `staking-abi.ts` - Staking contract integration
- `user-service.ts` - User management utilities
- `admin-service.ts` - Admin operations
- `nft-service.ts` - NFT-related utilities

### Database Schema (Supabase)

**Key Tables**:
- `users` - User profiles with wallet addresses, points, NFT counts
- `raffles` - Raffle definitions with blockchain integration fields
- `raffle_entries` - User entries in raffles with ticket counts
- `admins` - Admin user permissions

**Important Fields**:
- Raffle status: `CREATED | ACTIVE | COMPLETED | CANCELLED | BLOCKCHAIN_FAILED`
- Blockchain tracking: `blockchain_tx_hash`, `blockchain_deployed_at`, `blockchain_error`
- Prize configuration: `prize_token_address`, `prize_token_type` (NFT/ERC20)

### Authentication & Authorization

- SIWE-based wallet authentication through NextAuth
- Session management with JWT strategy
- Admin role verification through `admins` table
- Guards: `AuthGuard.tsx`, `AdminGuard.tsx`

### Blockchain Integration

- **Primary Chain**: Ink (chain ID: 57073) with custom RPC endpoints
- **Fallback Chains**: Ethereum Mainnet, Polygon
- **Contract Types**: Raffle contracts, Staking contracts, NFT contracts
- **Wallet Integration**: RainbowKit with WalletConnect support

### State Management

- React Context: `PointsContext` for user points tracking
- TanStack React Query for server state management
- NextAuth session for authentication state

### Testing Configuration

- Jest with Node environment
- Path aliases configured (`@/*` → `src/*`)
- Test location: `__tests__/**/*.test.{js,ts}`
- Points logic tests specifically at `__tests__/points-logic.test.js`

## Environment Variables Required

- `NEXTAUTH_SECRET` - NextAuth session encryption
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase public key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase admin key (server-side)
- `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` - WalletConnect integration

## Key Development Notes

- Uses TypeScript path aliases (`@/*` maps to `src/*`)
- RLS (Row Level Security) enabled on Supabase with separate admin client
- Custom Ink blockchain configuration with specific RPC endpoints
- SIWE message verification for secure wallet-based authentication
- Raffle system includes both database and blockchain state synchronization
- Admin functions require wallet address verification against `admins` table