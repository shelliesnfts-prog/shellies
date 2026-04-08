# ShelliesPoints Implementation — Coding Agent Prompt

---

## Your Role

You are a senior full-stack Web3 engineer implementing an on-chain points system for a production NFT platform. You write secure, minimal, auditable Solidity and TypeScript. You do not add unrequested features. You do not leave TODOs. Every file you produce is production-ready.

---

## Project Context

**Repository:** `shellies_raffles` — a Next.js 15 / React 19 / TypeScript application on the Ink blockchain (Chain ID: 57073).

**What exists today (do not break these):**
- `src/lib/staking-abi.ts` — ABI of the deployed `TimeLockStaking` contract (read-only, never modify)
- `src/lib/staking-service.ts` — backend service that reads staking state
- `src/lib/nft-service.ts` — backend service that reads NFT balances via `balanceOf`
- `src/lib/wagmi.ts` — Wagmi config, Ink chain definition, `inkChain` export
- `src/lib/supabase.ts` — Supabase client (`supabase` anon, `supabaseAdmin` service role)
- `src/lib/auth.ts` — NextAuth + SIWE session; all protected API routes call `getServerSession(authOptions)`
- `src/app/api/bridge/convert-xp/route.ts` — existing XP conversion API (you will modify this)
- `src/app/api/admin/users/route.ts` — admin user management (you will modify this)
- `src/contexts/PointsContext.tsx` — global points state (you will modify this)
- `src/hooks/useClaiming.ts` — claim logic hooks (you will rewrite this)
- `src/components/XPBridge.tsx` — XP conversion UI (you will modify this)

**Architecture rules:**
- API routes authenticate with `getServerSession(authOptions)` — never skip this
- Use `supabaseAdmin || supabase` fallback pattern for DB calls in API routes
- Wagmi `useWriteContract` / `useReadContract` for all on-chain frontend interactions
- Chain is Ink (57073) only — import `inkChain` from `src/lib/wagmi.ts`
- Never use `any` in TypeScript
- Never hardcode private keys or contract addresses — use environment variables

---

## The Full Specification

Read `SHELLIES_POINTS_MIGRATION_PLAN.md` in the repository root before writing a single line of code. That file is the authoritative specification. Everything below summarises the key points but the plan file takes precedence on any detail.

---

## Implementation Tasks

Implement all phases in order. Complete each phase fully before moving to the next.

---

### PHASE 1 — Smart Contract: `contracts/ShelliesPoints.sol`

Create the directory `contracts/` if it does not exist.

**Contract requirements — implement exactly as specified:**

1. **Non-transferable points** — no `transfer`, no `approve`, no ERC-20 interface. Just `balances` mapping.

2. **Inherit from:** `Ownable`, `ReentrancyGuard` (OpenZeppelin). Use `ECDSA` library for signature recovery.

3. **State variables** — implement all of these, nothing more:
   ```solidity
   mapping(address => uint256) public balances;
   mapping(address => uint256) public lastClaim;
   mapping(address => uint256) public lastClaimWithFees;
   mapping(uint256 => bool)    public usedNonces;
   mapping(address => bool)    public operators;
   address public authorizedSigner;
   address public stakingContract;
   address public nftContract;
   // all config uint256 variables from the plan
   ```

4. **`claim()` function** — `external nonReentrant`:
   - Enforce `claimCooldown` against `lastClaim[msg.sender]`
   - Call `IERC721Minimal(nftContract).balanceOf(msg.sender)` for available NFTs
   - Call `ITimeLockStaking(stakingContract).getStakedTokens(msg.sender)` then loop calling `stakes(tokenId)` for each to get `lockPeriod`
   - **Critical:** `balanceOf` returns only wallet-held NFTs (staked NFTs sit in the staking contract, so they are already excluded). Do NOT subtract staked count from balanceOf result.
   - Apply `maxPointsPerClaim` cap
   - Update `lastClaim[msg.sender]` and `balances[msg.sender]` before emitting

5. **`claimWithFees()` function** — `external payable nonReentrant`:
   - Require both `claimWithFeesCost > 0` and `claimWithFeesReward > 0` (prevents accidental free mint if owner forgets to configure)
   - Require `msg.value >= claimWithFeesCost`
   - Apply cooldown only if `claimWithFeesCooldown > 0` (zero means no cooldown)
   - Refund excess ETH with `call{value: excess}("")` after state update
   - Uses `lastClaimWithFees` — independent of `lastClaim`

6. **`convertXp()` function** — `external nonReentrant`:
   - Parameters: `uint256 xpAmount, uint256 nonce, uint256 expiry, bytes calldata signature`
   - Checks in this order: expiry, nonce not used, xpAmount >= minXpToConvert, xpConversionRate > 0
   - Reconstruct hash: `keccak256(abi.encodePacked(msg.sender, xpAmount, nonce, expiry, block.chainid))`
   - Wrap with EIP-191 prefix before `ECDSA.recover`
   - Require `recovered == authorizedSigner`
   - Mark nonce used, compute `points = xpAmount / xpConversionRate`, require points > 0, credit balance

7. **`spend()` function** — `external nonReentrant`:
   - `onlyOperator` modifier (create this: `require(operators[msg.sender])`)
   - Require `amount > 0` and `balances[user] >= amount`
   - Deduct balance, emit event
   - **No `addPoints()` function exists** — this is intentional

8. **`adminMint()` / `adminBurn()`** — `external onlyOwner`:
   - Standard guards: non-zero address, non-zero amount, sufficient balance for burn

9. **`withdrawFees()`** — `external onlyOwner`:
   - Pull full contract ETH balance to `owner()`

10. **All `setX` config functions** — `external onlyOwner`, one per config variable listed in the plan. Emit a config-change event for each (e.g., `event ConfigUpdated(string param, uint256 value)`).

11. **Constructor:**
    ```solidity
    constructor(
        address _stakingContract,
        address _nftContract,
        address _authorizedSigner
    ) Ownable(msg.sender)
    ```
    Set all default config values from the plan in the constructor body.

12. **Interfaces** — define in the same file or a separate `contracts/interfaces/` directory:
    - `ITimeLockStaking` with `LockPeriod` enum, `getStakedTokens`, `stakes`
    - `IERC721Minimal` with `balanceOf`

**Security requirements for the contract:**
- `nonReentrant` on every function that modifies balances or transfers ETH
- Checks-Effects-Interactions: always update state before external calls or ETH transfers
- Use `ECDSA.recover` from OpenZeppelin — never raw `ecrecover`
- Every `require` must have a descriptive error string
- No `tx.origin` usage
- No unchecked arithmetic except where explicitly safe (Solidity 0.8+ default overflow protection is sufficient)

**Solidity version:** `^0.8.20`

---

### PHASE 2 — TypeScript ABI & Contract Config

**File: `src/lib/shellies-points-abi.ts`**

Export `shelliesPointsAbi` as a `const` array with full ABI entries for every public/external function and all events. Include the complete ABI — do not abbreviate. Follow the exact same structure and naming as `src/lib/staking-abi.ts`.

**File: `src/lib/shellies-points-contract.ts`**

```ts
export const SHELLIES_POINTS_ADDRESS = (
  process.env.NEXT_PUBLIC_SHELLIES_POINTS_CONTRACT_ADDRESS || '0x'
) as `0x${string}`

export const SHELLIES_POINTS_CONTRACT = {
  address: SHELLIES_POINTS_ADDRESS,
  abi: shelliesPointsAbi,
} as const
```

---

### PHASE 3 — Backend Service: `src/lib/shellies-points-service.ts`

This service is used by API routes (server-side only). It must:

1. **`getBalance(walletAddress: string): Promise<number>`**
   - Read `balances[wallet]` from contract via viem `publicClient`
   - Return as JavaScript number

2. **`getClaimStatus(walletAddress: string): Promise<{ lastClaim: number, cooldown: number, canClaim: boolean, secondsRemaining: number }>`**
   - Read `lastClaim[wallet]` and `claimCooldown` from contract
   - Compute `canClaim` and `secondsRemaining`

3. **`getClaimWithFeesStatus(walletAddress: string): Promise<{ lastClaim: number, cooldown: number, canClaim: boolean, cost: bigint, reward: number }>`**
   - Read `lastClaimWithFees[wallet]`, `claimWithFeesCooldown`, `claimWithFeesCost`, `claimWithFeesReward`

4. **`signConvertXpVoucher(walletAddress: string, xpAmount: number, nonce: number, expiry: number): Promise<string>`**
   - Sign using `AUTHORIZED_SIGNER_PRIVATE_KEY` env var via ethers.js `Wallet.signMessage`
   - Hash: `ethers.solidityPackedKeccak256(['address','uint256','uint256','uint256','uint256'], [wallet, xpAmount, nonce, expiry, INK_CHAIN_ID])`
   - Return hex signature string

5. **`adminMint(walletAddress: string, amount: number): Promise<string>`** (returns tx hash)
6. **`adminBurn(walletAddress: string, amount: number): Promise<string>`** (returns tx hash)

Use the same viem `publicClient` pattern as `src/lib/staking-service.ts`. For write functions (adminMint, adminBurn), use ethers.js `Wallet` with `OWNER_PRIVATE_KEY` env var — or document clearly that these are called from admin scripts, not the API server.

---

### PHASE 4 — Database Migration

**File: `migrations/028_create_points_nonces_table.sql`**

```sql
CREATE TABLE shellies_points_nonces ( ... );  -- full spec in plan section 5
CREATE INDEX ...;
```

**File: `migrations/029_add_deduct_xp_function.sql`**

Implement the `deduct_xp_and_record_nonce` function exactly as specified in plan section 5.

---

### PHASE 5 — Modify `/api/bridge/convert-xp/route.ts`

Read the existing file fully before modifying. The change is only in the final step:

**Remove:** any code that writes `points` to the `shellies_raffle_users` table.

**Add:** after all existing validation passes —
1. Generate a unique nonce (`Date.now()` + random suffix to avoid collisions)
2. Set `expiry = Math.floor(Date.now() / 1000) + 600` (10 minutes)
3. Call `deduct_xp_and_record_nonce` Supabase RPC (atomically deducts XP + records nonce)
4. Call `shelliesPointsService.signConvertXpVoucher(wallet, xpAmount, nonce, expiry)`
5. Return `{ success: true, xpAmount, nonce, expiry, signature }` — do NOT return `newPoints`

All other validation logic (payment tx verification, session check, minimum XP check, used-transaction check) stays exactly as it is today.

---

### PHASE 6 — Modify `/api/admin/users/route.ts`

Read the existing file fully before modifying.

Find the block that updates `points` in Supabase. Replace it with:
```ts
if (pointsDelta > 0) await shelliesPointsService.adminMint(wallet, pointsDelta)
if (pointsDelta < 0) await shelliesPointsService.adminBurn(wallet, Math.abs(pointsDelta))
```

Preserve all existing auth checks, admin validation, and other user update logic unchanged.

---

### PHASE 7 — Modify `/api/dashboard/route.ts` and `/api/user/route.ts`

Read both files fully before modifying.

In each, find where `points` is read from `shellies_raffle_users`. Replace that specific field with a call to `shelliesPointsService.getBalance(walletAddress)`. Merge the result into the response object at the same key (`points`). Do not restructure the response shape — other consumers depend on it.

---

### PHASE 8 — Delete Old Claim API Routes

Delete these three files entirely:
- `src/app/api/claim/route.ts`
- `src/app/api/claim-staking/route.ts`
- `src/app/api/claim-unified/route.ts`

Create a new lightweight read-only replacement at `src/app/api/claim/route.ts` with only a `GET` handler that returns the current claim status by reading from the contract via `shelliesPointsService.getClaimStatus()` and `getClaimWithFeesStatus()`. This is used by the frontend for cooldown display only.

---

### PHASE 9 — Rewrite `src/hooks/useClaiming.ts`

Read the existing file fully before rewriting.

The new hook must:
1. Use wagmi `useWriteContract` for `claim()` and `claimWithFees()`
2. Use wagmi `useReadContract` for `lastClaim`, `claimCooldown`, `lastClaimWithFees`, `claimWithFeesCooldown`, `claimWithFeesCost`, `claimWithFeesReward`
3. Compute `canClaim`, `secondsUntilClaim`, `canClaimWithFees`, `secondsUntilClaimWithFees` from contract reads
4. Export the same interface shape as today where possible — `PointsContext.tsx` depends on it

---

### PHASE 10 — Modify `src/contexts/PointsContext.tsx`

Read the existing file fully before modifying.

Replace:
- The three API-based claim calls (`executeRegularClaim`, `executeStakingClaim`, `executeUnifiedClaim`) with two contract-based calls (`executeClaim`, `executeClaimWithFees`) using the rewritten `useClaiming` hook
- The Supabase `points` fetch with `shelliesPointsService.getBalance()` (server) or a wagmi `useReadContract` call (client)

Preserve:
- The `PointsProvider` wrapper structure
- `updatePoints(newPoints)` helper for optimistic UI updates
- All other user data fields (`nft_count`, `game_score`, etc.)

---

### PHASE 11 — Modify `src/components/XPBridge.tsx`

Read the existing file fully before modifying.

The XP Bridge becomes a two-step flow:

**Step 1 (existing):** User submits payment tx hash → calls `/api/bridge/convert-xp` → receives `{ xpAmount, nonce, expiry, signature }`.

**Step 2 (new):** Display a "Confirm on-chain" button. When clicked, call `ShelliesPoints.convertXp(xpAmount, nonce, expiry, signature)` via wagmi `useWriteContract`. Show tx pending state. On success, refresh the points balance.

Add a clear UI message between steps explaining: *"Your XP has been reserved. Submit the transaction below to receive your ShelliesPoints."*

If the user closes the modal after Step 1 but before Step 2, store `{ xpAmount, nonce, expiry, signature }` in `localStorage` under key `shellies_pending_conversion`. On next open, if a pending conversion exists and `expiry > Date.now()/1000`, pre-fill Step 2.

---

### PHASE 12 — Migration Script: `scripts/migrate-points-onchain.ts`

Implement exactly as specified in plan section 6, including:
- Supabase fetch of all wallets with `points > 0`
- `Math.round()` for decimal conversion
- `adminMint` call per wallet with tx confirmation wait
- CSV audit log output to `migration-audit.csv`
- Skip wallets where `Math.round(points) === 0` and log them as skipped

Add a `--dry-run` flag: when present, log what would be minted without sending any transactions.

---

## Constraints — Do Not Do These

- Do not add any function, event, modifier, or state variable not specified in the plan
- Do not make `balances` transferable or add any ERC-20 interface
- Do not add a general-purpose `addPoints(address, uint256)` operator function — this is intentionally absent
- Do not modify `src/lib/staking-abi.ts`, `src/lib/staking-service.ts`, or `src/lib/wagmi.ts`
- Do not change the response shape of any API route unless the plan explicitly says to
- Do not add `console.log` debug statements to production code
- Do not use `any` in TypeScript
- Do not hardcode addresses, private keys, or chain IDs outside of config/env files
- Do not skip `nonReentrant` on any balance-modifying function in the contract
- Do not use `tx.origin` anywhere

---

## Verification Checklist

After completing all phases, verify:

**Contract:**
- [ ] `claim()` correctly reads `balanceOf` (available) + `getStakedTokens` (staked) independently
- [ ] `claimWithFees()` reverts if `claimWithFeesCost == 0` or `claimWithFeesReward == 0`
- [ ] `claimWithFees()` has no cooldown when `claimWithFeesCooldown == 0`
- [ ] `convertXp()` rejects replayed nonces
- [ ] `convertXp()` rejects expired signatures
- [ ] `convertXp()` rejects signatures for a different `msg.sender`
- [ ] `spend()` reverts for non-operators
- [ ] No function increases balances without one of the four authorised paths
- [ ] `withdrawFees()` transfers ETH to owner, not to `msg.sender` unless owner

**Backend:**
- [ ] `/api/bridge/convert-xp` no longer writes to `shellies_raffle_users.points`
- [ ] Nonce is recorded in DB before signature is returned
- [ ] XP is deducted from `game_score` before signature is returned

**Frontend:**
- [ ] `useClaiming` reads cooldown state from contract, not from API
- [ ] XPBridge stores pending voucher in localStorage for recovery
- [ ] PointsContext reads balance from contract, not from Supabase `points` column

**Migration script:**
- [ ] `--dry-run` works without sending transactions
- [ ] Wallets with `points < 0.5` are skipped and logged
- [ ] Audit CSV is written with all minted amounts and tx hashes

---

## File Inventory — Expected Output

```
NEW files:
  contracts/ShelliesPoints.sol
  src/lib/shellies-points-abi.ts
  src/lib/shellies-points-contract.ts
  src/lib/shellies-points-service.ts
  migrations/028_create_points_nonces_table.sql
  migrations/029_add_deduct_xp_function.sql
  scripts/migrate-points-onchain.ts

MODIFIED files:
  src/app/api/bridge/convert-xp/route.ts
  src/app/api/admin/users/route.ts
  src/app/api/dashboard/route.ts
  src/app/api/user/route.ts
  src/app/api/claim/route.ts          (replaced with read-only GET)
  src/hooks/useClaiming.ts            (rewrite)
  src/contexts/PointsContext.tsx      (modified)
  src/components/XPBridge.tsx         (modified)

DELETED files:
  src/app/api/claim-staking/route.ts
  src/app/api/claim-unified/route.ts
```

---

## Reference: Key Existing Patterns to Follow

**API route auth pattern** (copy from any existing protected route):
```ts
const session = await getServerSession(authOptions)
if (!session?.address) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
const walletAddress = session.address.toLowerCase()
```

**Supabase client pattern:**
```ts
const client = supabaseAdmin || supabase
```

**Wagmi contract read pattern** (follow existing hooks in `src/hooks/`):
```ts
const { data } = useReadContract({
  address: SHELLIES_POINTS_ADDRESS,
  abi: shelliesPointsAbi,
  functionName: 'balances',
  args: [address],
})
```

**Viem public client** (follow `src/lib/staking-service.ts` for the setup pattern with primary + backup RPC).
