# Quick Start: Testing Wallet Connection Fix

## 🚀 Immediate Testing (5 minutes)

### Step 1: Start the Development Server
```bash
npm run dev
```

### Step 2: Test the Main Fix (Session Persistence)

1. **Open browser** (Chrome/Firefox/Brave)
2. **Navigate to** `http://localhost:3000`
3. **Click** "Connect Wallet"
4. **Approve** connection in wallet extension
5. **Sign** the SIWE message
6. **Click** "Enter Portal"
7. **Verify** you're in the portal ✅
8. **Close the browser completely** (not just the tab)
9. **Reopen browser** and go to `http://localhost:3000`
10. **Wait 2 seconds**

**Expected Result:**
- ✅ You should see "Enter Portal" button immediately
- ✅ Wallet should show as connected in extension
- ✅ You can click "Enter Portal" without reconnecting
- ✅ Console shows: "Attempting to reconnect with connector: [name]"

**If it doesn't work:**
- Check wallet extension is unlocked
- Check console for errors
- Verify `recentConnectorId` exists in localStorage (F12 → Application → Local Storage)

---

## 🔍 Quick Verification Checklist

Open browser console (F12) and check:

```javascript
// 1. Check localStorage
localStorage.getItem('recentConnectorId')
// Should return: "metaMask" or "rabby" or similar

// 2. Check session
fetch('/api/auth/session').then(r => r.json()).then(console.log)
// Should return: { address: "0x...", chainId: 57073 }

// 3. Check wagmi store
localStorage.getItem('wagmi.store')
// Should return: JSON with connection state
```

---

## 🧪 Quick Test Scenarios

### Test 1: Fresh Connection (2 min)
```
1. Clear storage: localStorage.clear()
2. Refresh page
3. Connect wallet
4. Sign message
5. Enter portal
✅ Should work smoothly
```

### Test 2: Auto-Reconnect (2 min)
```
1. Connect wallet (if not already)
2. Close browser completely
3. Reopen and navigate to app
4. Wait 2 seconds
✅ Should auto-reconnect
```

### Test 3: Wallet Disconnect (1 min)
```
1. Connect wallet and enter portal
2. Open wallet extension
3. Click "Disconnect"
4. Return to app
✅ Should redirect to home
```

### Test 4: Address Switch (2 min)
```
1. Connect wallet and enter portal
2. Open wallet extension
3. Switch to different account
4. Return to app
✅ Should redirect to home
```

---

## 📊 Console Log Reference

### Good Logs (Expected)
```
✅ "Attempting to reconnect with connector: MetaMask"
✅ "Wallet reconnected successfully"
✅ "Session exists but wallet disconnected. Attempting auto-reconnect..."
```

### Warning Logs (Expected in certain scenarios)
```
⚠️ "Wallet disconnected, clearing session..."
⚠️ "Account switch detected, clearing session..."
⚠️ "Address mismatch detected, clearing session..."
```

### Error Logs (Investigate these)
```
❌ "Auto-reconnect failed: [error]"
❌ "SIWE verification failed"
❌ "Connection error: [error]"
```

---

## 🛠️ Quick Debugging

### Issue: Wallet doesn't reconnect

**Quick Fix:**
```javascript
// In browser console:
console.log('Connector ID:', localStorage.getItem('recentConnectorId'));
// If null, reconnect manually once to set it
```

### Issue: Session not persisting

**Quick Fix:**
```javascript
// Check if session cookie exists
document.cookie.split(';').find(c => c.includes('next-auth'))
// Should return the session token
```

### Issue: Address mismatch

**Quick Fix:**
```javascript
// Clear everything and start fresh
localStorage.clear();
sessionStorage.clear();
location.reload();
```

---

## 🎯 Success Indicators

You'll know it's working when:

1. ✅ **No manual reconnection needed** after browser restart
2. ✅ **"Enter Portal" button visible** immediately on return
3. ✅ **Wallet extension shows connected** without user action
4. ✅ **Console shows reconnection logs** on page load
5. ✅ **No "wallet not connected" errors** when performing actions

---

## 📱 Test on Different Browsers

Quick test on each:

- [ ] Chrome/Edge
- [ ] Firefox
- [ ] Brave
- [ ] Safari (if on Mac)

Each should auto-reconnect after browser restart.

---

## 🔧 Environment Check

Verify these are set in `.env`:

```bash
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your-project-id
```

---

## 📞 Quick Support

If you encounter issues:

1. **Check console** for error messages
2. **Clear storage** and try again
3. **Verify wallet is unlocked**
4. **Check network connection**
5. **Review** `WALLET_CONNECTION_GUIDE.md` for patterns

---

## ⏱️ Performance Check

Time these operations:

- **Fresh connection**: Should complete in <5 seconds
- **Auto-reconnection**: Should complete in <2 seconds
- **Session validation**: Should be instant
- **Portal access**: Should be immediate after connection

---

## 🎉 You're Done!

If all quick tests pass, the fix is working correctly. You can now:

1. Test more complex scenarios (see `TESTING_WALLET_SESSION.md`)
2. Review implementation details (see `WALLET_SESSION_SYNC_FIX.md`)
3. Learn usage patterns (see `WALLET_CONNECTION_GUIDE.md`)
4. Deploy to production with confidence

---

## 🚨 Emergency Rollback

If something breaks:

```bash
# 1. Stop the server
Ctrl+C

# 2. Revert changes
git checkout HEAD -- src/lib/wagmi.ts
git checkout HEAD -- src/lib/auth.ts
git checkout HEAD -- src/components/PrivyProviders.tsx
git checkout HEAD -- src/components/AuthGuard.tsx
git checkout HEAD -- src/hooks/useAccountMonitor.ts
rm src/hooks/useWalletSync.ts

# 3. Restart server
npm run dev
```

---

**Total Testing Time**: ~10 minutes
**Confidence Level**: High (if all tests pass)
**Ready for Production**: Yes (after full test suite)
