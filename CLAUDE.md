# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start development server (Next.js)
npm run build        # Build for production
npm test             # Run all Jest tests
npm run test:watch   # Run tests in watch mode
npm run test:points  # Run only points logic tests
```

Run a single test file:
```bash
npx jest __tests__/payment-integration.test.js
```

## Architecture Overview

**Shellies Raffles** is a Next.js 15 (App Router) + React 19 application for an NFT raffle/gaming platform on the Ink blockchain (Chain ID: 57073).

### Authentication Flow

Authentication uses **NextAuth + SIWE (Sign-In With Ethereum)**. The session stores `address` and `chainId`. All protected API routes call `getServerSession(authOptions)` from `src/lib/auth.ts` to validate. The wallet connection UI is handled by RainbowKit via `src/components/PrivyProviders.tsx` (despite the filename, it uses RainbowKit, not Privy — the file is misnamed from an earlier migration).

### Data Layer

- **Supabase** (`src/lib/supabase.ts`): Two clients — `supabase` (anon, subject to RLS) and `supabaseAdmin` (service role, bypasses RLS). API routes should use `supabaseAdmin || supabase` with a fallback. Main tables: `shellies_raffle_users`, `shellies_raffle_entries`, `shellies_raffles`, `shellies_raffle_admins`, `shellies_raffle_game_sessions`, `shellies_payment_tiers`.
- **Migrations** are in `migrations/` as numbered SQL files. Apply them manually via Supabase dashboard or CLI.

### Blockchain Integration

- Chain: Ink (chain ID 57073), configured in `src/lib/wagmi.ts`
- Three contracts: Raffle contract, Staking contract, Game Payment contract
- Contract ABIs: `src/lib/raffle-abi.ts`, `src/lib/staking-abi.ts`, `src/lib/game-payment-abi.ts`
- Contract addresses come from environment variables (`NEXT_PUBLIC_*` prefix)
- Services wrapping contract calls: `src/lib/raffle-contract.ts`, `src/lib/staking-service.ts`, `src/lib/game-payment-service.ts`
- Transaction verification (server-side): `src/lib/services/transaction-verification.ts`

### Pricing / Tier System

`src/lib/services/app-settings-service.ts` reads the `shellies_payment_tiers` table. Three tiers: `regular`, `nft_holder` (requires ≥1 Shellies NFT), `staker` (requires ≥1 staked NFT). Pricing is stored in the DB so it can change without contract redeployment. The tier detection happens client-side in `src/hooks/useGamePayment.ts` then verified server-side.

### Key Application Areas

- **Portal** (`src/app/portal/`): Protected user pages — game, profile, raffles, staking, leaderboard, trade
- **Admin** (`src/app/admin/`): Admin-only dashboard — raffles CRUD, user management, sessions, withdrawals, XP settings. Protected by `src/components/AdminGuard.tsx`
- **API Routes** (`src/app/api/`): All follow the pattern: validate session → validate input → interact with Supabase/blockchain → return response

### Global State

Two React contexts (both in `src/contexts/`):
- `PointsContext`: User data, points, claim status, claim actions — wraps NextAuth session
- `ThemeContext`: Dark/light theme toggle

Root providers in `src/app/layout.tsx`: `Web3Providers` → `ThemeProvider` → `PointsProvider`

### XP to Points Conversion

Flow: User earns XP in-game → clicks convert → pays ETH via `payToConvertXP()` on the Game Payment contract → transaction hash submitted to `/api/bridge/convert-xp` → server verifies the on-chain transaction → points credited in Supabase. Recovery mechanism exists for interrupted conversions.

### Game Integration

The Mario game is a static iframe asset in `public/mario-game-v2/`. It communicates with the Next.js app via `postMessage`. `src/components/MarioGameConsoleV2.tsx` and `src/hooks/useGameScore.ts` handle score collection. Game sessions require an active record in `shellies_raffle_game_sessions` (created after payment verification).

## Environment Variables

Required:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXTAUTH_SECRET`
- `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID`
- `NEXT_PUBLIC_GAME_PAYMENT_CONTRACT_ADDRESS`
- `NEXT_PUBLIC_OWNER_WALLET`
- Contract addresses for raffle and staking contracts (check `src/lib/` files for exact env var names)
