# Testing Guide: Wallet Connection & Session Management

## Test Environment Setup

1. **Clear Browser State** (before each test):
   ```javascript
   // Open browser console and run:
   localStorage.clear();
   sessionStorage.clear();
   // Then refresh the page
   ```

2. **Check Console Logs**:
   - Open browser DevTools (F12)
   - Go to Console tab
   - Look for logs from `useAccountMonitor` and `useWalletSync`

## Test Cases

### Test 1: Fresh Connection Flow ✅

**Steps:**
1. Open app in fresh browser (or after clearing storage)
2. Click "Connect Wallet"
3. Approve connection in wallet extension
4. Sign SIWE message
5. Click "Enter Portal"

**Expected Results:**
- ✅ Wallet connects successfully
- ✅ SIWE signature prompt appears
- ✅ Session is created
- ✅ Portal page loads
- ✅ Console shows: "Wallet reconnected successfully" or similar

**Check localStorage:**
```javascript
localStorage.getItem('recentConnectorId') // Should show connector ID
```

---

### Test 2: Session Persistence (The Main Fix) ✅

**Steps:**
1. Connect wallet and enter portal (complete Test 1)
2. Close browser completely
3. Reopen browser and navigate to app
4. Wait 1-2 seconds

**Expected Results:**
- ✅ Session is restored automatically
- ✅ Wallet auto-reconnects (check wallet extension shows connected)
- ✅ "Enter Portal" button is visible immediately
- ✅ Can access portal without reconnecting
- ✅ Console shows: "Attempting to reconnect with connector: [name]"

**If wallet doesn't auto-reconnect:**
- Check if wallet extension is unlocked
- Check console for errors
- Verify `recentConnectorId` exists in localStorage

---

### Test 3: Wallet Disconnection During Session ✅

**Steps:**
1. Connect wallet and enter portal
2. While in portal, open wallet extension
3. Manually disconnect the wallet
4. Try to perform any action in the portal

**Expected Results:**
- ✅ Console shows: "Wallet disconnected, clearing session..."
- ✅ User is redirected to home page
- ✅ Session is cleared
- ✅ Must reconnect to access portal again

---

### Test 4: Wallet Address Switch ✅

**Steps:**
1. Connect wallet (Address A) and enter portal
2. Open wallet extension
3. Switch to different account (Address B)
4. Return to app

**Expected Results:**
- ✅ Console shows: "Account switch detected, clearing session..."
- ✅ User is redirected to home page
- ✅ Session is cleared
- ✅ Cache is purged
- ✅ Must reconnect with new address

---

### Test 5: Session Exists But Wallet Not Connected ✅

**Steps:**
1. Connect wallet and enter portal
2. Open browser DevTools → Application → Storage
3. Keep NextAuth session cookie but clear wagmi storage:
   ```javascript
   // In console:
   Object.keys(localStorage)
     .filter(key => key.includes('wagmi'))
     .forEach(key => localStorage.removeItem(key));
   ```
4. Refresh page

**Expected Results:**
- ✅ AuthGuard shows "Wallet Not Connected" warning
- ✅ "Connect Wallet" button is displayed
- ✅ After reconnecting, portal access is restored
- ✅ Console shows auto-reconnect attempt

---

### Test 6: Address Mismatch Detection ✅

**Steps:**
1. Connect with Address A, enter portal
2. Manually edit session in DevTools (advanced):
   - Go to Application → Cookies
   - Find `next-auth.session-token`
   - Note: This is JWT encoded, hard to edit manually
3. Alternative: Connect with Address A, then use different wallet extension with Address B

**Expected Results:**
- ✅ AuthGuard detects mismatch
- ✅ Shows warning with both addresses
- ✅ Provides "Sign Out & Go Home" option
- ✅ Console shows: "Address mismatch detected"

---

### Test 7: Session Expiration ✅

**Steps:**
1. Connect wallet and enter portal
2. Wait 24 hours (or modify `maxAge` in auth.ts to 60 seconds for testing)
3. Try to access portal

**Expected Results:**
- ✅ Session expires after configured time
- ✅ User is redirected to home
- ✅ Must reconnect to access portal

**Quick Test (modify auth.ts temporarily):**
```typescript
session: {
  strategy: 'jwt',
  maxAge: 60, // 1 minute for testing
  updateAge: 30, // 30 seconds
},
```

---

### Test 8: Multiple Browser Tabs ✅

**Steps:**
1. Connect wallet in Tab 1, enter portal
2. Open Tab 2 with same app
3. Disconnect wallet in Tab 1
4. Switch to Tab 2

**Expected Results:**
- ✅ Tab 2 detects disconnection
- ✅ Both tabs redirect to home
- ✅ Session is cleared across tabs

---

### Test 9: Network Switch (Wrong Chain) ✅

**Steps:**
1. Connect wallet on Ink Chain
2. Enter portal
3. Switch to different network in wallet (e.g., Ethereum Mainnet)
4. Try to perform action

**Expected Results:**
- ✅ RainbowKit shows "Wrong Network" button
- ✅ User is prompted to switch back to Ink Chain
- ✅ Session remains valid
- ✅ Operations blocked until correct network

---

### Test 10: Rapid Connection/Disconnection ✅

**Steps:**
1. Connect wallet
2. Immediately disconnect
3. Reconnect quickly
4. Repeat 3-4 times

**Expected Results:**
- ✅ No race conditions or errors
- ✅ State remains consistent
- ✅ No duplicate sessions created
- ✅ Console logs show proper state transitions

---

## Debugging Commands

### Check Current State
```javascript
// In browser console:

// Check localStorage
console.log('Connector:', localStorage.getItem('recentConnectorId'));
console.log('Wagmi Store:', localStorage.getItem('wagmi.store'));

// Check session
fetch('/api/auth/session')
  .then(r => r.json())
  .then(console.log);

// Check wallet connection (if wagmi is exposed)
// This requires adding window.wagmi in dev mode
```

### Force Clear Everything
```javascript
// Nuclear option - clear all state
localStorage.clear();
sessionStorage.clear();
document.cookie.split(";").forEach(c => {
  document.cookie = c.replace(/^ +/, "")
    .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
});
location.reload();
```

### Monitor Events
```javascript
// Listen for account switch events
window.addEventListener('accountSwitched', (e) => {
  console.log('Account switched:', e.detail);
});
```

---

## Common Issues & Solutions

### Issue: Wallet doesn't auto-reconnect

**Solutions:**
1. Check wallet extension is unlocked
2. Verify `recentConnectorId` in localStorage
3. Check console for connection errors
4. Try manual reconnection
5. Clear localStorage and reconnect fresh

### Issue: "Address mismatch" warning persists

**Solutions:**
1. Sign out completely
2. Clear browser storage
3. Reconnect with correct wallet
4. Ensure only one wallet extension is active

### Issue: Session expires too quickly

**Solutions:**
1. Check `maxAge` in `src/lib/auth.ts`
2. Verify `NEXTAUTH_SECRET` is set
3. Check browser isn't clearing cookies
4. Increase `updateAge` for more frequent refreshes

### Issue: Console shows reconnection errors

**Solutions:**
1. Check wallet extension is installed and enabled
2. Verify WalletConnect project ID is valid
3. Check network connectivity
4. Try different connector (MetaMask vs WalletConnect)

---

## Performance Monitoring

### Key Metrics to Watch

1. **Auto-reconnection Success Rate**
   - Should be >95% when wallet is unlocked
   - Check console logs for failures

2. **Session Sync Time**
   - Should complete within 1-2 seconds
   - Longer times indicate network issues

3. **Memory Usage**
   - localStorage should stay under 5MB
   - Clear old data periodically

4. **Console Errors**
   - Should see minimal errors in normal operation
   - Connection errors are expected when wallet locked

---

## Automated Testing (Future)

Consider adding these E2E tests:

```typescript
// Example Playwright test
test('wallet auto-reconnects with valid session', async ({ page }) => {
  // Connect wallet
  await page.goto('/');
  await page.click('button:has-text("Connect Wallet")');
  // ... complete connection flow
  
  // Close and reopen
  await page.close();
  const newPage = await context.newPage();
  await newPage.goto('/');
  
  // Verify auto-reconnection
  await expect(newPage.locator('button:has-text("Enter Portal")')).toBeVisible();
});
```

---

## Success Criteria

All tests should pass with these results:

- ✅ Fresh connections work smoothly
- ✅ Sessions persist across browser restarts
- ✅ Wallets auto-reconnect when session exists
- ✅ Disconnections are detected and handled
- ✅ Address switches clear sessions properly
- ✅ No console errors in normal operation
- ✅ UI shows appropriate warnings/prompts
- ✅ Performance is acceptable (<2s for reconnection)

---

## Reporting Issues

If you find issues, please report with:

1. **Browser & Version**: Chrome 120, Firefox 121, etc.
2. **Wallet Extension**: MetaMask 11.x, Rabby 0.x, etc.
3. **Test Case**: Which test failed
4. **Console Logs**: Copy relevant error messages
5. **Steps to Reproduce**: Detailed steps
6. **Expected vs Actual**: What should happen vs what happened

---

## Next Steps After Testing

1. Monitor production logs for connection issues
2. Track auto-reconnection success rates
3. Gather user feedback on connection experience
4. Consider adding retry logic for failed reconnections
5. Implement analytics for connection patterns
