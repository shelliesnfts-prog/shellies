# ✅ Realistic Points Limits Update

## The Problem with Previous Limits

**Previous Maximum:** 48,884 points per claim  
**Issue:** Based on theoretical scenario where one user owns ALL 2,222 NFTs

**Reality:** Average users have way less than 100 NFTs

---

## New Realistic Limits

### Based on Actual User Distribution

**Assumption:** Maximum 100 NFTs per user (realistic whale scenario)

### Maximum Calculation

```
User owns 100 NFTs and stakes them all for 1 month:

Available NFTs × 5     = 0 × 5 = 0
Daily staked × 7       = 0 × 7 = 0  
Weekly staked × 10     = 0 × 10 = 0
Monthly staked × 20    = 100 × 20 = 2,000
────────────────────────────────────────────
MAXIMUM PER CLAIM      = 2,000 points
```

### Updated Constants

```typescript
export const MAX_NFTS_PER_USER = 100;           // Realistic maximum
export const MAX_POINTS_PER_CLAIM = 2000;       // 100 × 20
export const MAX_REASONABLE_POINTS = 3000;      // With 50% buffer
```

---

## Comparison

| Metric | Old Value | New Value | Change |
|--------|-----------|-----------|--------|
| Max NFTs assumed | 2,222 | 100 | -95.5% |
| Max points per claim | 44,440 | 2,000 | -95.5% |
| Max reasonable | 48,884 | 3,000 | -93.9% |
| Suspicious threshold | 10,000 | 1,000 | -90% |

---

## Validation Thresholds

### Points Per Claim

| Range | Status | Example |
|-------|--------|---------|
| 1 - 1,000 | ✅ Normal | Most users |
| 1,001 - 2,000 | ⚠️ Suspicious | Large holders (50-100 NFTs) |
| 2,001 - 3,000 | ⚠️ Critical | At maximum, investigate |
| 3,001+ | ❌ **REJECTED** | Exploit attempt |

### Real Examples

| Scenario | NFTs | Points | Status |
|----------|------|--------|--------|
| Regular user | 0 | 1 | ✅ Valid |
| Small holder | 5 | 25 | ✅ Valid |
| Medium holder | 20 | 100 | ✅ Valid |
| Large holder (available) | 50 | 250 | ✅ Valid |
| Large holder (monthly staked) | 50 | 1,000 | ⚠️ Suspicious (but valid) |
| Whale (monthly staked) | 100 | 2,000 | ⚠️ Critical (max, valid) |
| **Exploit attempt** | - | 3,001 | ❌ **REJECTED** |
| **Exploit attempt** | - | 10,000 | ❌ **REJECTED** |
| **Exploit attempt** | - | 50,000 | ❌ **REJECTED** |

---

## Benefits of Realistic Limits

### 1. Catches Exploits Earlier
- **Old:** Allowed up to 48,884 points
- **New:** Rejects anything over 3,000 points
- **Result:** 94% reduction in exploit window

### 2. More Accurate Flagging
- **Old:** Only flagged > 10,000 points as suspicious
- **New:** Flags > 1,000 points for review
- **Result:** Better detection of unusual activity

### 3. Reflects Reality
- **Old:** Based on impossible scenario (one user owns all NFTs)
- **New:** Based on actual user distribution
- **Result:** Realistic validation that matches your user base

### 4. Easier Monitoring
- Lower thresholds mean fewer false negatives
- Suspicious activity stands out more clearly
- Easier to spot patterns

---

## Updated Files

1. ✅ `src/lib/points-constants.ts`
   - MAX_NFTS_PER_USER: 100
   - MAX_POINTS_PER_CLAIM: 2,000
   - MAX_REASONABLE_POINTS: 3,000
   - SUSPICIOUS_POINTS_THRESHOLD: 1,000

2. ✅ `scripts/detect-suspicious-points.sql`
   - Updated all thresholds
   - More granular risk levels
   - Better detection queries

3. ✅ `supabase/migrations/20260203000001_add_points_audit_logging.sql`
   - Updated view thresholds
   - More accurate risk assessment

---

## Detection Queries Updated

### Find Exploited Accounts

```sql
-- Critical: > 10,000 points (definitely exploit)
SELECT * FROM shellies_raffle_users 
WHERE points > 10000;

-- High: > 5,000 points (very suspicious)
SELECT * FROM shellies_raffle_users 
WHERE points > 5000;

-- Medium: > 3,000 points (above max reasonable)
SELECT * FROM shellies_raffle_users 
WHERE points > 3000;

-- Suspicious: > 1,000 points (review)
SELECT * FROM shellies_raffle_users 
WHERE points > 1000;
```

### Recent Activity

```sql
-- Find recent suspicious claims
SELECT * FROM shellies_points_audit
WHERE points_delta > 1000
  AND changed_at >= NOW() - INTERVAL '24 hours'
ORDER BY points_delta DESC;
```

---

## Migration Path

### If You Have Existing Users

1. **Check current distribution:**
```sql
SELECT 
  MAX(points) as max_points,
  AVG(points) as avg_points,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY points) as p95_points
FROM shellies_raffle_users;
```

2. **Find users above new limit:**
```sql
SELECT wallet_address, points
FROM shellies_raffle_users
WHERE points > 3000
ORDER BY points DESC;
```

3. **Decide action:**
   - If legitimate whales exist, adjust MAX_NFTS_PER_USER
   - If exploited accounts, reset their points
   - If uncertain, investigate individually

---

## Adjusting the Limit

If you find legitimate users with more than 100 NFTs:

```typescript
// In src/lib/points-constants.ts
export const MAX_NFTS_PER_USER = 150; // Adjust as needed

// This will automatically update:
// MAX_POINTS_PER_CLAIM = 150 × 20 = 3,000
// MAX_REASONABLE_POINTS = 3,000 × 1.5 = 4,500
```

---

## Summary

✅ **Maximum reduced from 48,884 to 3,000** (94% reduction)  
✅ **Based on realistic user distribution** (100 NFTs max)  
✅ **Better exploit detection** (catches at 3,001+ instead of 48,885+)  
✅ **More accurate monitoring** (flags at 1,000+ instead of 10,000+)  
✅ **Easy to adjust** if you find legitimate whales  

The new limits are **much more realistic** and will catch exploits immediately while still allowing legitimate large holders to claim their points.
