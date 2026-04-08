# 🚀 Deploy Security Fixes - Quick Guide

## ⚡ Quick Start (5 Minutes)

### Step 1: Apply Database Migrations (2 minutes)

1. Open Supabase Dashboard → SQL Editor
2. Run these migrations in order:

**Migration 1:**
```sql
-- Copy and paste from:
supabase/migrations/20260203000000_add_transaction_deduplication.sql
```

**Migration 2:**
```sql
-- Copy and paste from:
supabase/migrations/20260203000001_add_points_audit_logging.sql
```

### Step 2: Deploy Code (1 minute)

The code changes are already applied to these files:
- ✅ `src/app/api/user/route.ts`
- ✅ `src/app/api/game-score/route.ts`
- ✅ `src/app/api/bridge/convert-xp/route.ts`

Just commit and deploy:

```bash
git add .
git commit -m "fix: critical security vulnerabilities in points system"
git push origin main
```

### Step 3: Verify Fixes (2 minutes)

```bash
# Test vulnerable endpoint is disabled
curl -X POST https://your-domain.com/api/user \
  -H "Content-Type: application/json" \
  -d '{"action":"claim_daily","points":999999}'

# Expected: 410 Gone with deprecation message
```

---

## 🔍 Detect Exploited Accounts

### Run Detection Script

In Supabase SQL Editor, run queries from:
```
scripts/detect-suspicious-points.sql
```

### Quick Check for Recent Exploits

```sql
-- Find wallets with >10k points gained in last 24 hours
SELECT 
  wallet_address,
  points,
  updated_at,
  EXTRACT(HOUR FROM (NOW() - updated_at)) as hours_ago
FROM shellies_raffle_users
WHERE updated_at >= NOW() - INTERVAL '24 hours'
  AND points > 10000
ORDER BY points DESC;
```

---

## 🛠️ If You Find Exploited Accounts

### Option 1: Reset Points (Recommended)

```sql
-- Reset specific wallet
UPDATE shellies_raffle_users
SET points = 0,
    updated_at = NOW()
WHERE wallet_address = '0xEXPLOITER_ADDRESS';

-- Or reset all suspicious accounts
UPDATE shellies_raffle_users
SET points = 0,
    updated_at = NOW()
WHERE points > 100000
  AND updated_at >= NOW() - INTERVAL '7 days';
```

### Option 2: Adjust to Reasonable Amount

```sql
-- Set to reasonable maximum (e.g., 50k points)
UPDATE shellies_raffle_users
SET points = 50000,
    updated_at = NOW()
WHERE points > 100000;
```

---

## 📊 Monitor After Deployment

### Check Audit Logs

```sql
-- View all point changes in last hour
SELECT 
  wallet_address,
  old_points,
  new_points,
  points_delta,
  change_reason,
  changed_at
FROM shellies_points_audit
WHERE changed_at >= NOW() - INTERVAL '1 hour'
ORDER BY changed_at DESC;
```

### Check for Suspicious Activity

```sql
-- View suspicious changes
SELECT * FROM shellies_suspicious_point_changes
WHERE changed_at >= NOW() - INTERVAL '24 hours'
ORDER BY changed_at DESC;
```

### Monitor Used Transactions

```sql
-- Check XP conversions
SELECT 
  wallet_address,
  tx_hash,
  xp_converted,
  points_gained,
  used_at
FROM shellies_used_transactions
WHERE used_at >= NOW() - INTERVAL '24 hours'
ORDER BY used_at DESC;
```

---

## ✅ Post-Deployment Checklist

- [ ] Database migrations applied successfully
- [ ] Code deployed to production
- [ ] Vulnerable endpoint returns 410 Gone
- [ ] Detection script run
- [ ] Exploited accounts identified (if any)
- [ ] Points reset for exploiters (if needed)
- [ ] Audit logging working
- [ ] Monitoring set up
- [ ] Team notified of changes

---

## 🚨 Rollback Plan (If Needed)

If something goes wrong:

### Rollback Code
```bash
git revert HEAD
git push origin main
```

### Rollback Database (Migrations)

```sql
-- Drop audit trigger
DROP TRIGGER IF EXISTS points_change_audit_trigger ON shellies_raffle_users;

-- Drop audit function
DROP FUNCTION IF EXISTS log_points_change();

-- Drop audit tables (CAUTION: Loses audit data)
DROP TABLE IF EXISTS shellies_points_audit;
DROP TABLE IF EXISTS shellies_used_transactions;

-- Drop views
DROP VIEW IF EXISTS shellies_suspicious_point_changes;
DROP VIEW IF EXISTS shellies_daily_point_summary;
```

**Note:** Only rollback if absolutely necessary. The fixes are critical for security.

---

## 📞 Support

If you encounter issues:

1. Check error logs in Supabase Dashboard
2. Review application logs
3. Run diagnostics:
   ```bash
   npm test -- __tests__/security-points-manipulation.test.js
   ```

---

## 🎯 Success Criteria

You'll know the deployment was successful when:

1. ✅ `/api/user` POST returns 410 Gone
2. ✅ Game scores > 100k are rejected
3. ✅ Duplicate transaction hashes are rejected
4. ✅ All point changes appear in audit log
5. ✅ No new suspicious point gains

---

**Estimated Total Time:** 5-10 minutes  
**Risk Level:** Low (fixes are well-tested)  
**Downtime Required:** None  
**Rollback Time:** < 2 minutes if needed
