# ShelliesPoints On-Chain Migration Plan

> **Status:** All open decisions resolved — ready for implementation.

## Overview

Migrate the current off-chain Supabase points system to an on-chain `ShelliesPoints` smart contract on the Ink blockchain (Chain ID: 57073). The contract is non-transferable (points stay tied to the earning wallet), fully configurable by the owner, and exposes two claim paths plus a secured XP conversion function.

---

## 1. Contract: `ShelliesPoints.sol`

### 1.1 Storage & State

```solidity
// Balances (non-transferable)
mapping(address => uint256) public balances;

// Free claim cooldown tracking
mapping(address => uint256) public lastClaim;           // timestamp per wallet

// Paid claim cooldown tracking
mapping(address => uint256) public lastClaimWithFees;   // timestamp per wallet

// XP conversion replay protection
mapping(uint256 => bool) public usedNonces;

// Roles
address public owner;
mapping(address => bool) public operators;              // raffle contract address only
address public authorizedSigner;                        // backend signing key for convertXp

// External contracts
address public stakingContract;                         // TimeLockStaking (deployed, no changes)
address public nftContract;                             // Shellies ERC721
```

### 1.2 Config Variables (all owner-settable)

#### Free Claim — `claim()`

| Variable | Default | Setter |
|---|---|---|
| `claimCooldown` | `86400` (24 h) | `setClaimCooldown(uint256)` |
| `pointsForRegularUser` | `1` | `setPointsForRegularUser(uint256)` |
| `pointsPerAvailableNFT` | `5` | `setPointsPerAvailableNFT(uint256)` |
| `pointsPerDailyStakedNFT` | `7` | `setPointsPerDailyStakedNFT(uint256)` |
| `pointsPerWeeklyStakedNFT` | `10` | `setPointsPerWeeklyStakedNFT(uint256)` |
| `pointsPerMonthlyStakedNFT` | `20` | `setPointsPerMonthlyStakedNFT(uint256)` |
| `maxPointsPerClaim` | `2000` | `setMaxPointsPerClaim(uint256)` |

#### Paid Claim — `claimWithFees()`

| Variable | Default | Setter |
|---|---|---|
| `claimWithFeesReward` | owner sets before enabling | `setClaimWithFeesReward(uint256)` |
| `claimWithFeesCost` | owner sets before enabling | `setClaimWithFeesCost(uint256)` |
| `claimWithFeesCooldown` | `0` (no cooldown) | `setClaimWithFeesCooldown(uint256)` |

> Default cooldown is `0` meaning no cooldown until the owner sets one. Setting it to `86400` gives a 24 h cooldown matching the free claim. Owner can set any value including back to `0`.

#### XP Conversion — `convertXp()`

| Variable | Default | Setter |
|---|---|---|
| `xpConversionRate` | `10` (10 XP = 1 pt) | `setXpConversionRate(uint256)` |
| `minXpToConvert` | `100` | `setMinXpToConvert(uint256)` |
| `authorizedSigner` | set at deploy | `setAuthorizedSigner(address)` |

#### Contract Refs & Roles

| Variable | Setter |
|---|---|
| `stakingContract` | `setStakingContract(address)` |
| `nftContract` | `setNFTContract(address)` |
| `operators` | `setOperator(address, bool)` |

---

### 1.3 Function Specifications

---

#### `claim()` — Free NFT/staking-based daily claim

**Access:** Public — any wallet calls for themselves.

**NFT count logic (fixed from current backend bug):**
- `IERC721(nftContract).balanceOf(msg.sender)` = NFTs currently in wallet (staked NFTs are held by the staking contract, so `balanceOf` already excludes them — no subtraction needed)
- `getStakedTokens(msg.sender).length` = NFTs in staking contract

**Security checks:**
1. `block.timestamp >= lastClaim[msg.sender] + claimCooldown` — cooldown enforced on-chain
2. State updated (`lastClaim`, `balances`) before any external reads complete — reentrancy guard covers the rest
3. `maxPointsPerClaim` hard cap prevents misconfigured reward rates from minting runaway points

```solidity
function claim() external nonReentrant {
    require(
        block.timestamp >= lastClaim[msg.sender] + claimCooldown,
        "Cooldown not elapsed"
    );

    // Read available NFTs (in wallet — staked NFTs are NOT here, they live in staking contract)
    uint256 availableNFTs = IERC721(nftContract).balanceOf(msg.sender);

    // Read staked NFTs and classify by lock period
    uint256[] memory stakedIds = ITimeLockStaking(stakingContract).getStakedTokens(msg.sender);
    uint256 daily; uint256 weekly; uint256 monthly;

    for (uint256 i = 0; i < stakedIds.length; i++) {
        (,,,, ITimeLockStaking.LockPeriod period) =
            ITimeLockStaking(stakingContract).stakes(stakedIds[i]);
        if      (period == ITimeLockStaking.LockPeriod.DAY)   daily++;
        else if (period == ITimeLockStaking.LockPeriod.WEEK)  weekly++;
        else if (period == ITimeLockStaking.LockPeriod.MONTH) monthly++;
    }

    // Calculate points
    uint256 totalNFTs = availableNFTs + stakedIds.length;
    uint256 points;

    if (totalNFTs == 0) {
        // Regular user: no NFTs anywhere
        points = pointsForRegularUser;
    } else {
        points = (availableNFTs  * pointsPerAvailableNFT)
               + (daily          * pointsPerDailyStakedNFT)
               + (weekly         * pointsPerWeeklyStakedNFT)
               + (monthly        * pointsPerMonthlyStakedNFT);
    }

    // Apply hard cap
    if (points > maxPointsPerClaim) points = maxPointsPerClaim;

    // Effects — update state before emitting
    lastClaim[msg.sender] = block.timestamp;
    balances[msg.sender] += points;

    emit Claimed(msg.sender, points, block.timestamp);
}
```

---

#### `claimWithFees()` — Paid fixed-reward claim

**Access:** Public — any wallet, pays `claimWithFeesCost` ETH per call.

**Cooldown:** Configurable by owner. Default `0` (no cooldown). If set, each wallet has its own `lastClaimWithFees` timestamp tracked separately from the free claim.

**Security checks:**
1. `claimWithFeesCost > 0` and `claimWithFeesReward > 0` — both must be configured before the function is usable, prevents accidental free minting if owner forgets to set values
2. `msg.value >= claimWithFeesCost` — correct ETH sent
3. Cooldown check (if `claimWithFeesCooldown > 0`)
4. Excess ETH refunded — no ETH trapped in contract by overpaying

```solidity
function claimWithFees() external payable nonReentrant {
    require(claimWithFeesCost > 0,   "Paid claim: cost not configured");
    require(claimWithFeesReward > 0, "Paid claim: reward not configured");
    require(msg.value >= claimWithFeesCost, "Insufficient fee");

    // Cooldown check (skipped when claimWithFeesCooldown == 0)
    if (claimWithFeesCooldown > 0) {
        require(
            block.timestamp >= lastClaimWithFees[msg.sender] + claimWithFeesCooldown,
            "Paid claim cooldown not elapsed"
        );
        lastClaimWithFees[msg.sender] = block.timestamp;
    }

    // Refund excess ETH
    uint256 excess = msg.value - claimWithFeesCost;

    // Effects
    balances[msg.sender] += claimWithFeesReward;

    // Refund after state update (checks-effects-interactions)
    if (excess > 0) {
        (bool ok,) = msg.sender.call{value: excess}("");
        require(ok, "Refund failed");
    }

    emit ClaimedWithFees(msg.sender, claimWithFeesReward, claimWithFeesCost);
}
```

---

#### `convertXp()` — User converts game XP to ShelliesPoints (signed voucher)

**Access:** Public — user calls with a backend-issued signed voucher. Backend never touches the contract directly for this function.

**End-to-end flow:**

```
1. User → POST /api/bridge/convert-xp
   { paymentTxHash, xpAmount }

2. Backend:
   a. Verify paymentTxHash on-chain (same as today)
   b. Verify game session is valid
   c. Check Supabase game_score >= xpAmount
   d. Atomically in DB:
      - Deduct xpAmount from game_score
      - Insert nonce into shellies_points_nonces (status: 'pending')
   e. Sign: keccak256(wallet, xpAmount, nonce, expiry, chainId)
      using AUTHORIZED_SIGNER_PRIVATE_KEY
   f. Return { xpAmount, nonce, expiry, signature }

3. User → ShelliesPoints.convertXp(xpAmount, nonce, expiry, signature)
   (user's own wallet transaction — backend not involved)

4. Contract:
   a. Verify expiry not passed
   b. Verify nonce not used
   c. Verify xpAmount >= minXpToConvert
   d. Recover signer from signature — must equal authorizedSigner
   e. Mark nonce used
   f. Award xpAmount / xpConversionRate points to msg.sender
   g. Emit XpConverted

5. Backend (async): listens for XpConverted event
   → updates shellies_points_nonces status to 'completed'
```

**Why the contract signs `xpAmount` not `points`:**
The contract computes `points = xpAmount / xpConversionRate` on-chain, making the conversion rate transparent and auditable by anyone. The user can verify the rate before submitting.

**Security properties:**
- `msg.sender` embedded in hash — voucher bound to one wallet only, cannot be forwarded
- `block.chainid` embedded — voucher invalid on any other chain
- `nonce` single-use and tracked on-chain — replay impossible even if signature is leaked
- `expiry` short window (~10 min) — minimises exposure if voucher is intercepted
- `authorizedSigner` is a dedicated key (not the owner key) — compromise is isolated
- XP deducted in DB before signing — if user never submits, XP is spent, no points minted (safe failure mode)

```solidity
function convertXp(
    uint256 xpAmount,
    uint256 nonce,
    uint256 expiry,
    bytes calldata signature
) external nonReentrant {
    require(block.timestamp <= expiry,     "Voucher expired");
    require(!usedNonces[nonce],            "Nonce already used");
    require(xpAmount >= minXpToConvert,    "Below minimum XP");
    require(xpConversionRate > 0,          "Conversion rate not configured");

    // Reconstruct and verify signature
    bytes32 messageHash = keccak256(abi.encodePacked(
        msg.sender,
        xpAmount,
        nonce,
        expiry,
        block.chainid
    ));
    bytes32 ethSignedHash = keccak256(abi.encodePacked(
        "\x19Ethereum Signed Message:\n32",
        messageHash
    ));
    address recovered = ECDSA.recover(ethSignedHash, signature);
    require(recovered == authorizedSigner, "Invalid signature");

    // Effects
    usedNonces[nonce] = true;
    uint256 pointsToAward = xpAmount / xpConversionRate;
    require(pointsToAward > 0, "XP too low for even 1 point at current rate");
    balances[msg.sender] += pointsToAward;

    emit XpConverted(msg.sender, xpAmount, pointsToAward, nonce);
}
```

---

#### `spend()` — Deduct points (raffle entry)

**Access:** Operators only. The only registered operator is the raffle contract address.

**Security checks:**
1. `operators[msg.sender]` — only raffle contract can call this
2. `balances[user] >= amount` — no underflow, explicit revert with clear message
3. `nonReentrant` — raffle contract is trusted but guard is cheap insurance

```solidity
function spend(address user, uint256 amount) external onlyOperator nonReentrant {
    require(amount > 0,                    "Amount must be > 0");
    require(balances[user] >= amount,      "Insufficient points balance");
    balances[user] -= amount;
    emit PointsSpent(user, amount, msg.sender);
}
```

> **`addPoints()` is intentionally absent.** There is no general operator-callable mint function. The only ways to increase a balance are `claim()`, `claimWithFees()`, `convertXp()`, and `adminMint()`. This minimises the attack surface — no operator key compromise can silently inflate balances.

---

#### `adminMint()` / `adminBurn()` — Owner-only balance adjustments

Used for: initial migration airdrop, manual corrections, tournament rewards.

```solidity
function adminMint(address user, uint256 amount) external onlyOwner {
    require(user != address(0), "Zero address");
    require(amount > 0,         "Amount must be > 0");
    balances[user] += amount;
    emit AdminMint(user, amount);
}

function adminBurn(address user, uint256 amount) external onlyOwner {
    require(balances[user] >= amount, "Balance too low to burn");
    balances[user] -= amount;
    emit AdminBurn(user, amount);
}
```

---

#### `withdrawFees()` — Pull accumulated ETH from `claimWithFees`

```solidity
function withdrawFees() external onlyOwner {
    uint256 bal = address(this).balance;
    require(bal > 0, "Nothing to withdraw");
    (bool ok,) = owner().call{value: bal}("");
    require(ok, "Withdraw failed");
    emit FeesWithdrawn(owner(), bal);
}
```

---

### 1.4 Complete `setX` Owner Functions

```solidity
// Free claim config
function setClaimCooldown(uint256 seconds_) external onlyOwner;
function setPointsForRegularUser(uint256 amount) external onlyOwner;
function setPointsPerAvailableNFT(uint256 amount) external onlyOwner;
function setPointsPerDailyStakedNFT(uint256 amount) external onlyOwner;
function setPointsPerWeeklyStakedNFT(uint256 amount) external onlyOwner;
function setPointsPerMonthlyStakedNFT(uint256 amount) external onlyOwner;
function setMaxPointsPerClaim(uint256 amount) external onlyOwner;

// Paid claim config
function setClaimWithFeesReward(uint256 amount) external onlyOwner;
function setClaimWithFeesCost(uint256 weiAmount) external onlyOwner;
function setClaimWithFeesCooldown(uint256 seconds_) external onlyOwner;  // 0 = no cooldown

// XP conversion config
function setXpConversionRate(uint256 rate) external onlyOwner;
function setMinXpToConvert(uint256 amount) external onlyOwner;
function setAuthorizedSigner(address signer) external onlyOwner;

// Contract refs
function setStakingContract(address addr) external onlyOwner;
function setNFTContract(address addr) external onlyOwner;
function setOperator(address addr, bool status) external onlyOwner;
```

---

### 1.5 Events

```solidity
event Claimed(address indexed user, uint256 points, uint256 timestamp);
event ClaimedWithFees(address indexed user, uint256 points, uint256 feePaid);
event XpConverted(address indexed user, uint256 xpAmount, uint256 points, uint256 nonce);
event PointsSpent(address indexed user, uint256 amount, address indexed spender);
event AdminMint(address indexed user, uint256 amount);
event AdminBurn(address indexed user, uint256 amount);
event FeesWithdrawn(address indexed to, uint256 amount);
```

### 1.6 Interfaces Used by the Contract

```solidity
interface ITimeLockStaking {
    enum LockPeriod { DAY, WEEK, MONTH }

    function getStakedTokens(address user)
        external view returns (uint256[] memory);

    function stakes(uint256 tokenId) external view returns (
        uint256 tokenId_,
        address owner_,
        uint256 stakedAt,
        uint256 lockEndTime,
        LockPeriod lockPeriod
    );

    function isStaker(address user) external view returns (bool);
}

interface IERC721Minimal {
    function balanceOf(address owner) external view returns (uint256);
}
```

### 1.7 Dependencies

- `OpenZeppelin Ownable` — owner management & `onlyOwner` modifier
- `OpenZeppelin ReentrancyGuard` — applied to `claim`, `claimWithFees`, `convertXp`, `spend`
- `OpenZeppelin ECDSA` — signature recovery in `convertXp`

---

## 2. New Files Required

| File | Purpose |
|---|---|
| `contracts/ShelliesPoints.sol` | The new contract |
| `src/lib/shellies-points-abi.ts` | ABI for frontend + backend |
| `src/lib/shellies-points-contract.ts` | Contract address + chain config |
| `src/lib/shellies-points-service.ts` | Backend helpers: `getBalance`, `signVoucher` |
| `scripts/migrate-points-onchain.ts` | One-time migration airdrop script |

---

## 3. Backend Changes

### 3.1 `/api/bridge/convert-xp` — Modified (issue signed voucher instead of writing points)

```ts
// Steps 1–N unchanged: verify payment tx, check session, check XP balance

// CHANGED: atomically deduct XP + record nonce
const nonce = Date.now()  // or a DB sequence — must be unique
const expiry = Math.floor(Date.now() / 1000) + 600  // 10 min

await supabaseAdmin.rpc('deduct_xp_and_record_nonce', {
    wallet: walletAddress,
    xp_amount: xpToConvert,
    nonce,
    expiry_ts: new Date(expiry * 1000).toISOString()
})

// Sign the voucher
const messageHash = ethers.solidityPackedKeccak256(
    ['address', 'uint256', 'uint256', 'uint256', 'uint256'],
    [walletAddress, xpToConvert, nonce, expiry, INK_CHAIN_ID]
)
const signature = await signerWallet.signMessage(ethers.getBytes(messageHash))

// Return to frontend — user submits the on-chain tx themselves
return NextResponse.json({ xpAmount: xpToConvert, nonce, expiry, signature })
```

**New env var:**
```
AUTHORIZED_SIGNER_PRIVATE_KEY=0x...
```
The corresponding public address must be set as `authorizedSigner` on the deployed contract.

### 3.2 Claim API Routes — Deleted

Claiming is now a direct user→contract transaction. These files are deleted:
- `src/app/api/claim/route.ts`
- `src/app/api/claim-staking/route.ts`
- `src/app/api/claim-unified/route.ts`

A lightweight read-only endpoint can replace them for UI display (reads `lastClaim[address]` and config from contract — no auth needed, just a public RPC call).

### 3.3 `/api/admin/users` — Modified

```ts
// OLD
await supabase.from('shellies_raffle_users').update({ points }).eq('wallet_address', wallet)

// NEW
if (action === 'add')    await shelliesPointsService.adminMint(wallet, amount)
if (action === 'remove') await shelliesPointsService.adminBurn(wallet, amount)
```

### 3.4 `/api/dashboard` and `/api/user` — Modified

```ts
// OLD
const { data } = await supabase.from('shellies_raffle_users').select('points').eq(...)

// NEW — read from contract
const balance = await shelliesPointsService.getBalance(walletAddress)
```

### 3.5 `/api/raffle-entries/enter` — Modified

Points deduction moves on-chain. **Raffle contract (Option A — redeployment):**
- Frontend calls raffle contract `enterRaffle(raffleId, ticketCount)`
- Raffle contract calls `IShelliesPoints(pointsContract).spend(msg.sender, cost)` internally
- Backend receives the emitted event, records the entry in DB for display

The backend no longer calls `atomic_raffle_entry_wallet()`. It verifies the on-chain tx instead.

---

## 4. Frontend Changes

### 4.1 `src/hooks/useClaiming.ts` — Rewrite

```ts
// Free claim
const { writeContract: writeClaim } = useWriteContract()
const executeClaim = () => writeClaim({
    address: SHELLIES_POINTS_ADDRESS,
    abi: shelliesPointsAbi,
    functionName: 'claim',
})

// Paid claim
const { writeContract: writeClaimWithFees } = useWriteContract()
const executeClaimWithFees = (feeCost: bigint) => writeClaimWithFees({
    address: SHELLIES_POINTS_ADDRESS,
    abi: shelliesPointsAbi,
    functionName: 'claimWithFees',
    value: feeCost,
})
```

### 4.2 `src/contexts/PointsContext.tsx` — Modified

- Remove all three API-based claim methods
- Expose `claim()` and `claimWithFees()` via wagmi contract writes
- Read `balances[address]` from contract via `useReadContract`
- Read `lastClaim[address]` + `claimCooldown` from contract for countdown display
- Read `lastClaimWithFees[address]` + `claimWithFeesCooldown` for paid claim cooldown display

### 4.3 `src/components/XPBridge.tsx` — Modified (two-step flow)

```
Step 1 (unchanged): User pays conversion fee → calls /api/bridge/convert-xp
                     API returns { xpAmount, nonce, expiry, signature }

Step 2 (new):        Frontend calls ShelliesPoints.convertXp(xpAmount, nonce, expiry, sig)
                     via wagmi useWriteContract — user signs this tx themselves

Step 3 (unchanged):  On success, UI refreshes balance
```

### 4.4 Portal Claim UI

- **"Claim Points"** button → calls `claim()` (free, 24 h cooldown)
- **"Buy Points"** button → calls `claimWithFees()` (paid, owner-configurable cooldown)
- Both buttons show their respective cooldown countdowns
- Show gas fee warning on both (these are now blockchain transactions)
- Show `claimWithFeesCost` ETH amount prominently before user confirms

---

## 5. Database Changes

### Columns deprecated after migration (keep until confirmed, then drop)

```sql
-- These become read-only historical records after migration
ALTER TABLE shellies_raffle_users
    RENAME COLUMN points    TO points_legacy;
ALTER TABLE shellies_raffle_users
    RENAME COLUMN last_claim TO last_claim_legacy;
```

### New table: `shellies_points_nonces`

Tracks issued XP conversion vouchers for backend state management:

```sql
CREATE TABLE shellies_points_nonces (
    nonce       BIGINT       PRIMARY KEY,
    wallet      TEXT         NOT NULL,
    xp_amount   INTEGER      NOT NULL,
    status      TEXT         NOT NULL DEFAULT 'pending', -- pending | completed | expired
    expiry      TIMESTAMPTZ  NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_nonces_wallet   ON shellies_points_nonces (wallet);
CREATE INDEX idx_nonces_status   ON shellies_points_nonces (status, expiry);
```

### New Supabase function: `deduct_xp_and_record_nonce`

Atomically deducts XP and records the nonce in a single transaction:

```sql
CREATE OR REPLACE FUNCTION deduct_xp_and_record_nonce(
    p_wallet      TEXT,
    p_xp_amount   INTEGER,
    p_nonce       BIGINT,
    p_expiry_ts   TIMESTAMPTZ
) RETURNS void AS $$
BEGIN
    -- Check sufficient XP
    IF (SELECT game_score FROM shellies_raffle_users
        WHERE wallet_address = p_wallet) < p_xp_amount THEN
        RAISE EXCEPTION 'Insufficient XP balance';
    END IF;

    -- Deduct XP
    UPDATE shellies_raffle_users
        SET game_score = game_score - p_xp_amount
        WHERE wallet_address = p_wallet;

    -- Record nonce
    INSERT INTO shellies_points_nonces (nonce, wallet, xp_amount, expiry)
        VALUES (p_nonce, p_wallet, p_xp_amount, p_expiry_ts);
END;
$$ LANGUAGE plpgsql;
```

### Supabase functions removed after cutover

- `process_user_claim()` — replaced by on-chain `claim()`
- `atomic_raffle_entry_wallet()` — replaced by on-chain `spend()` via raffle contract

---

## 6. Migration Script — `scripts/migrate-points-onchain.ts`

```ts
import { createClient } from '@supabase/supabase-js'
import { ethers } from 'ethers'
import * as fs from 'fs'

// Connect
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const provider = new ethers.JsonRpcProvider('https://rpc-gel.inkonchain.com')
const ownerWallet = new ethers.Wallet(process.env.OWNER_PRIVATE_KEY!, provider)
const contract = new ethers.Contract(
    process.env.SHELLIES_POINTS_ADDRESS!,
    ['function adminMint(address user, uint256 amount) external'],
    ownerWallet
)

// Fetch all wallets with points > 0
const { data: users } = await supabase
    .from('shellies_raffle_users')
    .select('wallet_address, points')
    .gt('points', 0)

const auditLog: string[] = ['wallet,legacy_points,minted_points,tx_hash']

for (const user of users!) {
    // Round to integer — 0.1 becomes 0 (below 0.5), 0.7 becomes 1, whole numbers unchanged
    // Regular users who had < 0.5 points: start fresh from 0 (they earn 1/day going forward)
    const onChainAmount = Math.round(user.points)

    if (onChainAmount <= 0) {
        auditLog.push(`${user.wallet_address},${user.points},0,skipped`)
        continue
    }

    const tx = await contract.adminMint(user.wallet_address, onChainAmount)
    await tx.wait()
    console.log(`✓ ${user.wallet_address}: ${user.points} → ${onChainAmount} pts | ${tx.hash}`)
    auditLog.push(`${user.wallet_address},${user.points},${onChainAmount},${tx.hash}`)
}

fs.writeFileSync('migration-audit.csv', auditLog.join('\n'))
console.log('Migration complete. Audit log saved to migration-audit.csv')
```

---

## 7. New Environment Variables

```bash
# Contract
NEXT_PUBLIC_SHELLIES_POINTS_CONTRACT_ADDRESS=0x...

# Backend signing key (address of this key = authorizedSigner on contract)
# Separate from OWNER key — isolated if compromised
AUTHORIZED_SIGNER_PRIVATE_KEY=0x...
```

---

## 8. Resolved Decisions

| # | Decision | Resolution |
|---|---|---|
| 1 | NFT count bug (double-subtraction) | **Fixed** — contract uses `balanceOf` (available) + `getStakedTokens` (staked) independently, no subtraction |
| 2 | `addPoints()` operator function | **Removed** — no general mint path for operators; only `claim`, `claimWithFees`, `convertXp`, `adminMint` can increase balances |
| 3 | Decimal points rounding | **Round to integer** — `Math.round()` in migration script. `pointsForRegularUser` defaults to `1` on-chain. Regular users with < 0.5 pts start at 0, earn 1/day going forward |
| 4 | Rate change during voucher window | **Accept risk** — 10-minute expiry window makes this negligible |
| 5 | `claimWithFees` cooldown | **Added as configurable** — `claimWithFeesCooldown` defaults to `0` (no cooldown). Owner sets it to any value. Free and paid claim cooldowns are fully independent |
| 6 | Raffle contract cutover | **Maintenance window** — end all active raffles before deploying new raffle contract |

---

## 9. Implementation Phases

```
Phase 1 — Smart Contract
  → Write ShelliesPoints.sol
  → Write updated Raffle contract (IShelliesPoints + spend call)
  → Deploy both to Ink testnet
  → Write shellies-points-abi.ts, shellies-points-contract.ts

Phase 2 — Backend Service Layer
  → Write shellies-points-service.ts (getBalance, signVoucher)
  → Write deduct_xp_and_record_nonce Supabase function
  → Create shellies_points_nonces table (migration 028)
  → Modify /api/bridge/convert-xp → signed voucher flow
  → Modify /api/admin/users → adminMint/adminBurn
  → Modify /api/dashboard, /api/user → contract balance read
  → Add AUTHORIZED_SIGNER_PRIVATE_KEY to env

Phase 3 — Migration Script
  → Write scripts/migrate-points-onchain.ts
  → Test on testnet with Supabase data sample
  → Run on mainnet — save audit CSV

Phase 4 — Frontend
  → Rewrite useClaiming.ts → useWriteContract (claim + claimWithFees)
  → Update PointsContext.tsx → contract reads/writes
  → Update XPBridge.tsx → two-step flow (API voucher + on-chain tx)
  → Update portal UI → 2 claim buttons with cooldown displays + gas warnings

Phase 5 — Cutover (maintenance window)
  → End all active raffles
  → Run migration script
  → Set authorizedSigner on contract = AUTHORIZED_SIGNER_PRIVATE_KEY address
  → Set raffle contract as operator on ShelliesPoints
  → Deploy new raffle contract pointing to ShelliesPoints
  → Delete old claim route files
  → DB migration 029: rename legacy columns

Phase 6 — Cleanup
  → Drop process_user_claim() DB function
  → Drop atomic_raffle_entry_wallet() DB function
  → Remove XP bridge if no longer needed (or keep for game XP path)
```
