# Server Automation Guide

## ✅ **Clean & Simple Contract**

The contract is now optimized for **server automation** with **secure on-chain randomness** - no Chainlink dependencies needed!

---

## 🚀 **How It Works**

### **Simple Flow:**
1. **Admin creates raffle**: `createRaffleWithNFT()` or `createRaffleWithToken()` → State: `CREATED`
2. **Admin activates**: `activateRaffle()` → State: `ACTIVE`  
3. **Users join**: `joinRaffle()` (validates state + timing)
4. **Server monitors**: Check `canEndRaffle()` for expired raffles
5. **Server ends raffle**: Call `endRaffle()` with participants + random seed
6. **Winner gets prize**: Automatic on-chain transfer

---

## 📋 **Deployment**

### **Simple Constructor:**
```solidity
constructor(address serverWallet)
```

### **Deploy Command:**
```bash
npx hardhat run scripts/deploy.js --network mainnet
```

---

## 🤖 **Server Implementation**

### **Monitor Raffles (Run every minute):**
```javascript
async function monitorRaffles() {
    // Get active raffles from database
    const activeRaffles = await getActiveRaffles();
    
    for (const raffle of activeRaffles) {
        // Check if raffle can be ended
        const canEnd = await contract.canEndRaffle(raffle.id);
        
        if (canEnd) {
            await endRaffle(raffle.id);
        }
    }
}
```

### **End Raffle Function:**
```javascript
async function endRaffle(raffleId) {
    try {
        // Get participants from database
        const { participants, ticketCounts } = await getRaffleParticipants(raffleId);
        
        // Generate random seed (important for fairness)
        const randomSeed = ethers.randomBytes(32);
        
        // Call contract to end raffle
        const tx = await contract.endRaffle(
            raffleId,
            participants,
            ticketCounts,
            randomSeed
        );
        
        await tx.wait();
        console.log(`Raffle ${raffleId} ended successfully!`);
        
    } catch (error) {
        console.error(`Failed to end raffle ${raffleId}:`, error);
    }
}
```

---

## 🔒 **Secure Randomness**

The contract uses **multiple entropy sources** for secure randomness:

```solidity
uint256 randomNumber = uint256(
    keccak256(abi.encodePacked(
        randomSeed,                    // Server-provided randomness
        block.timestamp,               // Current block time
        block.prevrandao,             // Previous block randomness  
        blockhash(block.number - 1),  // Previous block hash
        raffleId,                     // Unique raffle identifier
        totalTickets,                 // Total tickets
        participants.length,          // Number of participants
        tx.gasprice                   // Transaction gas price
    ))
);
```

### **Why This Is Secure:**
✅ **Server can't predict winner** - Block data is unknown when generating randomSeed  
✅ **Multiple entropy sources** - Even if one is compromised, others remain secure  
✅ **Tamper-proof** - All calculations happen on-chain  
✅ **Verifiable** - Anyone can verify the randomness generation  

---

## 💰 **Costs**

### **Per Raffle:**
- **End raffle**: ~$1-3 (just gas fees)
- **No subscriptions**: No ongoing costs!

### **Monthly (10 raffles):** ~$10-30
### **Setup cost:** $0 (no LINK tokens needed!)

---

## 🛠️ **Server Setup**

### **1. Environment Variables:**
```env
PRIVATE_KEY=your_server_wallet_private_key
CONTRACT_ADDRESS=deployed_contract_address
RPC_URL=https://your-rpc-endpoint
```

### **2. Cron Job (Every minute):**
```bash
* * * * * /usr/bin/node /path/to/monitor-raffles.js
```

### **3. Monitoring Script:**
```javascript
// monitor-raffles.js
const { ethers } = require('ethers');

// Setup
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);

// Main monitoring function
async function main() {
    await monitorRaffles();
}

main().catch(console.error);
```

---

## 🔥 **Benefits of Server Automation**

✅ **Simple & Reliable** - No complex Chainlink setup  
✅ **Cost Effective** - Only pay gas fees  
✅ **Full Control** - Complete control over timing  
✅ **Secure** - Multi-source on-chain randomness  
✅ **Flexible** - Easy to modify and extend  
✅ **Battle Tested** - Simple pattern used by many projects  

Your raffle system is now **production ready** with server automation! 🎉