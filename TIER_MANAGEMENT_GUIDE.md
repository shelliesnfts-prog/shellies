# Payment Tier Management Guide

## ✅ Complete Implementation

Full tier management system with add/remove/activate/deactivate functionality.

---

## 🎯 Features

### Admin Panel (`/admin/withdrawals`)

#### View All Tiers
- See all tiers (active and inactive)
- Color-coded cards by tier type
- Shows NFT range, discount %, and pricing
- Inactive tiers display "⚠️ Inactive" badge

#### Add New Tier
1. Click "+ Add Tier" button
2. Fill in the form:
   - **Tier Name**: e.g., "platinum", "diamond" (lowercase, no spaces)
   - **Min NFTs**: Minimum NFTs required (e.g., 20)
   - **Max NFTs**: Maximum NFTs (leave blank for unlimited)
   - **Description**: Optional description
   - **Payment Amount**: Use ETH/USD converter
3. Click "Create Tier"

#### Update Tier
1. Click "Update" button on any tier card
2. Adjust payment amount using converter
3. Click "Update Amount"

#### Activate/Deactivate Tier
- Click ⏸ (pause) button to deactivate
- Click ▶ (play) button to reactivate
- Inactive tiers won't be used for pricing
- Users in inactive tiers fall back to next available tier

#### Delete Tier
1. Click 🗑 (trash) button on tier card
2. Confirm deletion in modal
3. **Note**: Cannot delete "regular" tier (protected)

---

## 📊 Default Tiers

| Tier | NFT Range | Amount (ETH) | Discount | Icon |
|------|-----------|--------------|----------|------|
| Regular | 0 | 0.00001 | 0% | 👤 |
| Bronze | 1-4 | 0.000005 | 50% | 🥉 |
| Silver | 5-9 | 0.000003 | 70% | 🥈 |
| Gold | 10+ | 0.000002 | 80% | 🥇 |

---

## 🔧 API Endpoints

### GET /api/payment-tiers
Fetch all tiers
- Query param: `?includeInactive=true` (for admin panel)
- Returns: Array of tier objects

### POST /api/payment-tiers
Create new tier (admin only)
```json
{
  "tier_name": "platinum",
  "payment_amount_wei": "1000000000000",
  "min_nfts": 20,
  "max_nfts": null,
  "description": "Platinum tier: 20+ NFTs"
}
```

### PUT /api/payment-tiers/[tier]
Update tier (admin only)
```json
{
  "payment_amount_wei": "1500000000000",
  "is_active": false
}
```

### DELETE /api/payment-tiers/[tier]
Delete tier (admin only)
- Cannot delete "regular" tier

### GET /api/payment-amount
Get user-specific payment amount
- Checks NFT ownership
- Returns appropriate tier and amount

---

## 🎮 User Experience

### Regular User (0 NFTs)
- Sees regular price
- No discount badge
- Pays full amount

### Bronze Holder (1-4 NFTs)
- Sees 50% discounted price
- Orange "🥉 Bronze Tier Active!" badge
- Shows NFT count

### Silver Holder (5-9 NFTs)
- Sees 70% discounted price
- Silver "🥈 Silver Tier Active!" badge
- Shows NFT count

### Gold Holder (10+ NFTs)
- Sees 80% discounted price
- Gold "🥇 Gold Tier Active!" badge
- Shows NFT count

---

## 💡 Examples

### Add Platinum Tier (20+ NFTs, 90% off)

**Via Admin Panel:**
1. Click "+ Add Tier"
2. Enter:
   - Name: `platinum`
   - Min NFTs: `20`
   - Max NFTs: (leave blank)
   - Amount: `0.000001 ETH`
3. Click "Create Tier"

**Via SQL (if needed):**
```sql
INSERT INTO payment_tiers (tier_name, payment_amount_wei, min_nfts, max_nfts, description)
VALUES ('platinum', '1000000000000', 20, NULL, 'Platinum tier: 20+ NFTs (90% discount)');
```

### Temporarily Disable Bronze Tier

1. Go to Admin Panel → Withdrawals
2. Find Bronze tier card
3. Click ⏸ (pause) button
4. Bronze tier is now inactive
5. Users with 1-4 NFTs will use Regular tier instead

### Change Silver Tier Range (5-9 → 5-14)

**Via Admin Panel:**
Currently not editable via UI (only amount can be changed)

**Via SQL:**
```sql
UPDATE payment_tiers 
SET max_nfts = 14 
WHERE tier_name = 'silver';
```

### Delete a Tier

1. Click 🗑 button on tier card
2. Confirm in modal
3. Tier is permanently deleted
4. Users in that tier fall back to next available tier

---

## 🛡️ Security

- All admin operations require authentication
- API routes check `session?.isAdmin`
- Service role key used for database operations
- RLS policy allows public read of active tiers only
- Regular tier cannot be deleted (protected)

---

## 🐛 Troubleshooting

### Tier not showing in game
**Check:**
1. Is tier active? (no ⚠️ Inactive badge)
2. Does user's NFT count match tier range?
3. Clear browser cache and reload

### Cannot create tier
**Common issues:**
- Tier name already exists (must be unique)
- Min NFTs > Max NFTs (invalid range)
- Payment amount is 0 (must be > 0)
- Overlapping NFT ranges (check existing tiers)

### User seeing wrong tier
**Check:**
1. User's actual NFT count on blockchain
2. Tier NFT ranges don't overlap
3. Tiers are ordered correctly (min_nfts ascending)

---

## 📝 Best Practices

1. **Tier Naming**: Use lowercase, no spaces (e.g., `platinum`, `diamond`)
2. **NFT Ranges**: Avoid overlaps, ensure continuous coverage
3. **Testing**: Test with different NFT counts before going live
4. **Communication**: Announce new tiers to community
5. **Gradual Changes**: Don't change pricing too frequently

---

## 🚀 Future Enhancements

- Edit tier NFT ranges via UI
- Bulk tier operations
- Tier analytics (usage stats)
- Time-based tier activation
- Tier preview before activation
- Import/export tier configurations
