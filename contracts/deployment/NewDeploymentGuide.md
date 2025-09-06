# Updated Raffle Contract Deployment Guide (Phase 4)

## Overview
This guide describes the new deployment approach that removes server wallet dependency for raffle creation, implementing the admin wallet approach for better security and user control.

## Contract Changes Summary

### Removed Dependencies
- ❌ SERVER_ROLE no longer needed for raffle creation  
- ❌ Server wallet doesn't need to own prizes
- ❌ Complex server-side prize management eliminated

### Enhanced Security
- ✅ Admin wallets directly control their prizes
- ✅ Reduced attack surface (no server wallet custody)
- ✅ Transparent, user-controlled transactions
- ✅ Better separation of concerns

## Deployment Process

### 1. Contract Deployment
```solidity
// Deploy contract with only essential roles
constructor() {
    _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    _grantRole(ADMIN_ROLE, msg.sender);
    
    // Note: SERVER_ROLE still granted for automated raffle ending
    // but NOT required for raffle creation
    _grantRole(SERVER_ROLE, serverWalletAddress);
}
```

### 2. Environment Configuration
```bash
# Update environment variables
NEXT_PUBLIC_RAFFLE_CONTRACT_ADDRESS=0x...
# Remove deprecated server wallet vars (optional)
# RAFFLE_SERVER_PRIVATE_KEY=... # No longer needed for creation
```

### 3. Admin Setup
```typescript
// Grant admin role to authorized addresses
await contract.grantRole(ADMIN_ROLE, adminWalletAddress);
```

## New Raffle Creation Flow

### Admin Experience
1. **Create Raffle** (Database only)
   - Raffle saved as 'CREATED' status
   - No blockchain interaction yet

2. **Deploy to Blockchain** (Admin wallet)
   - Admin approves prize token
   - Admin calls createRaffleWithNFT/Token
   - Admin activates raffle
   - Database updated to 'ACTIVE'

### Technical Implementation
```typescript
// 1. Database creation
const raffle = await AdminService.createRaffle({
  ...raffleData,
  status: 'CREATED'
});

// 2. Admin wallet deployment
const deploymentResult = await RaffleContractService.adminCreateRaffleWithNFT(
  raffleId,
  prizeTokenAddress, 
  tokenId,
  endTimestamp,
  writeContract // wagmi hook
);

// 3. Database update
await AdminService.markRaffleDeployed(raffleId, deploymentResult.txHash);
```

## Benefits

### Security Improvements
- **No Server Custody**: Server never owns or controls prize tokens
- **Admin Control**: Admins maintain full control of their assets
- **Transparent Operations**: All transactions visible and signed by admin
- **Reduced Risk**: Eliminates server wallet as attack vector

### User Experience
- **Real-time Feedback**: Admins see transaction status immediately  
- **Better Error Handling**: Wallet rejections handled gracefully
- **Cost Transparency**: Admins pay their own gas fees
- **Flexible Retry**: Failed deployments can be retried easily

### Operational Benefits
- **Simplified Backend**: No complex server wallet management
- **Better Monitoring**: Clear separation of database vs blockchain operations
- **Easier Debugging**: Clearer error attribution and resolution
- **Lower Maintenance**: Reduced server-side complexity

## Migration from Legacy System

### For Existing Deployments
1. Existing raffles continue working normally
2. New raffles automatically use admin wallet flow
3. Server wallet methods return deprecation errors
4. Legacy API endpoints return HTTP 410 (Gone)

### Testing the Migration
1. Create test raffle using new admin wallet flow
2. Verify all deployment steps complete successfully
3. Test raffle entry and completion flows
4. Confirm database consistency

## Troubleshooting

### Common Issues

**1. Admin Wallet Not Connected**
```
Error: Please connect your wallet first
Solution: Ensure admin has connected wallet with ADMIN_ROLE
```

**2. Insufficient Prize Balance**
```
Error: ERC20: insufficient allowance
Solution: Admin must own and approve the prize tokens
```

**3. Transaction Rejected**
```
Error: User rejected the request
Solution: Admin must approve transactions in wallet
```

**4. Database Inconsistency**  
```
Error: Raffle not found or wrong status
Solution: Check raffle status in database, retry deployment if needed
```

## Monitoring and Maintenance

### Health Checks
- Monitor deployment success rates
- Track transaction failure patterns  
- Verify database consistency
- Check admin wallet balances

### Performance Metrics
- Average deployment time
- Transaction gas costs
- User completion rates
- Error frequencies

### Alerts
- Failed deployments
- Stuck transactions  
- Database/blockchain inconsistencies
- Admin wallet issues

## Future Enhancements

### Phase 5 Considerations
- Remove SERVER_ROLE entirely (after automated ending replacement)
- Implement on-chain raffle management
- Add multi-signature admin controls
- Integrate with governance systems

This completes the migration from server wallet dependency to admin wallet control, providing better security, transparency, and user experience.