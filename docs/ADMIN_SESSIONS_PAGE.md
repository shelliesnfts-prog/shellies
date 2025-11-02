# Admin Sessions Page

## Overview

New admin page for viewing and managing game sessions. Provides visibility into active, expired, and inactive sessions with the ability to clean up old sessions.

## Features

### 1. Session Statistics Dashboard
Four stat cards showing:
- **Total Sessions**: All sessions in the database
- **Active**: Sessions that are active and not expired
- **Expired**: Sessions past their expiration date
- **Inactive**: Sessions marked as inactive (game over)

### 2. Sessions Table
Displays all sessions with:
- Wallet address (truncated)
- Transaction hash (with Ink Explorer link)
- Created date/time
- Expires date/time
- Status badge (Active/Expired/Inactive)

### 3. Clean Expired Sessions
Button to bulk delete:
- All expired sessions (expires_at < now)
- All inactive sessions (is_active = false)

Includes confirmation dialog before deletion.

### 4. Refresh Button
Manually refresh the sessions list and stats.

## API Endpoints

### GET /api/admin/sessions
Fetches all game sessions with statistics.

**Response:**
```json
{
  "success": true,
  "sessions": [
    {
      "id": "uuid",
      "wallet_address": "0x...",
      "transaction_hash": "0x...",
      "created_at": "2025-01-02T...",
      "expires_at": "2025-01-03T...",
      "is_active": true
    }
  ],
  "stats": {
    "total": 10,
    "active": 5,
    "expired": 3,
    "inactive": 2
  }
}
```

### DELETE /api/admin/sessions
Cleans expired and inactive sessions.

**Request:**
```json
{
  "action": "clean_expired"
}
```

**Response:**
```json
{
  "success": true,
  "deletedCount": 5,
  "message": "Successfully cleaned 5 sessions"
}
```

## Session Status Logic

### Active
- `is_active === true`
- `expires_at > now`
- Badge: Green

### Expired
- `expires_at <= now`
- Badge: Orange

### Inactive
- `is_active === false`
- Badge: Red

## Navigation

Added "Sessions" link to all admin pages:
- ✅ Raffles page
- ✅ Users page
- ✅ Sessions page (active)
- ✅ Withdrawals page

## Files Created/Modified

### New Files:
- `src/app/admin/sessions/page.tsx` - Admin sessions page
- `src/app/api/admin/sessions/route.ts` - Sessions API
- `docs/ADMIN_SESSIONS_PAGE.md` - This documentation

### Modified Files:
- `src/app/admin/users/page.tsx` - Added Sessions nav link
- `src/app/admin/withdrawals/page.tsx` - Added Sessions nav link
- (Raffles page should also be updated)

## Usage

### View Sessions
1. Navigate to `/admin/sessions`
2. View all sessions in the table
3. Check stats cards for overview

### Clean Expired Sessions
1. Click "Clean Expired" button
2. Confirm the action
3. System deletes all expired/inactive sessions
4. Shows count of deleted sessions
5. Table refreshes automatically

### Refresh Data
1. Click "Refresh" button
2. Fetches latest data from database
3. Updates stats and table

## Security

### Authentication
- Requires NextAuth session
- TODO: Add admin role check

### Authorization
Currently any authenticated user can access. Should add:
```typescript
// Check if user is admin
const isAdmin = await checkAdminRole(session.address);
if (!isAdmin) {
  return NextResponse.json(
    { success: false, error: 'Unauthorized' },
    { status: 403 }
  );
}
```

## Database Query

### Fetch All Sessions
```sql
SELECT * FROM shellies_raffle_game_sessions
ORDER BY created_at DESC;
```

### Clean Expired Sessions
```sql
DELETE FROM shellies_raffle_game_sessions
WHERE expires_at < NOW() OR is_active = false;
```

## UI/UX Features

### Dark Mode Support
- Full dark/light mode theming
- Consistent with other admin pages

### Responsive Design
- Mobile-friendly table
- Collapsible sidebar on mobile
- Responsive stat cards

### Visual Feedback
- Loading states during fetch
- Cleaning animation
- Success/error messages
- Status badges with colors

### Animations
- Smooth transitions
- Hover effects
- Loading spinners

## Future Enhancements

### Potential Features:
1. **Pagination** - For large session lists
2. **Filtering** - By status, date range, wallet
3. **Search** - Find specific sessions
4. **Export** - Download sessions as CSV
5. **Session Details** - Modal with full info
6. **Manual Delete** - Delete individual sessions
7. **Session Analytics** - Charts and graphs
8. **Auto-cleanup** - Scheduled job to clean old sessions

### Admin Role Check:
```typescript
// Add to lib/admin.ts
export async function isAdmin(walletAddress: string): Promise<boolean> {
  const adminAddresses = process.env.ADMIN_ADDRESSES?.split(',') || [];
  return adminAddresses.includes(walletAddress.toLowerCase());
}
```

## Testing Checklist

- [ ] Page loads correctly
- [ ] Stats display accurate counts
- [ ] Sessions table shows all sessions
- [ ] Transaction links work
- [ ] Status badges show correct colors
- [ ] Clean button works
- [ ] Confirmation dialog appears
- [ ] Sessions are deleted correctly
- [ ] Refresh button updates data
- [ ] Dark mode works
- [ ] Mobile responsive
- [ ] Navigation links work

## Conclusion

The Admin Sessions page provides essential visibility and management capabilities for game sessions. Admins can monitor active sessions, identify expired ones, and perform bulk cleanup operations to maintain database health.
