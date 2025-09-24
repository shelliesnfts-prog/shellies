# Chainlink Configuration Guide

## 🔗 **What You Need to Deploy**

### **1. Chainlink VRF v2 Subscription**
- **Purpose**: Provides secure random numbers for winner selection
- **Cost**: ~0.25 LINK per request + gas fees
- **Setup**: Create subscription at [vrf.chain.link](https://vrf.chain.link)

### **2. Chainlink Automation (Keepers)**
- **Purpose**: Automatically ends raffles when time expires  
- **Cost**: ~$1-5 per raffle ending + gas fees
- **Setup**: Register upkeep at [automation.chain.link](https://automation.chain.link)

---

## 📋 **Deployment Parameters**

When deploying the contract, you need these Chainlink parameters:

```solidity
constructor(
    address serverWallet,           // Your server wallet address
    address vrfCoordinator,         // VRF Coordinator address (see below)
    uint64 subscriptionId,          // Your VRF subscription ID  
    bytes32 gasLane,                // Key hash for VRF (see below)
    uint32 callbackGasLimit,        // Gas limit for VRF callback (500000)
    uint256 interval                // Automation check interval (3600 = 1 hour)
)
```

### **Network-Specific Configuration**

#### **Ethereum Mainnet**
```javascript
const config = {
    vrfCoordinator: "0x271682DEB8C4E0901D1a1550aD2e64D568E69909",
    gasLane: "0x8af398995b04c28e9951adb9721ef74c74f93e6a478f39e7e0777be13527e7ef", // 200 gwei
    subscriptionId: YOUR_SUBSCRIPTION_ID, // Get from vrf.chain.link
    callbackGasLimit: 500000,
    interval: 3600 // 1 hour
}
```

#### **Polygon Mainnet**
```javascript
const config = {
    vrfCoordinator: "0xAE975071Be8F8eE67addBC1A82488F1C24858067",
    gasLane: "0x6e099d640cde6de9d40ac749b4b594126b0169747122711109c9985d47751f93", // 500 gwei
    subscriptionId: YOUR_SUBSCRIPTION_ID,
    callbackGasLimit: 500000, 
    interval: 3600
}
```

#### **Sepolia Testnet** (for testing)
```javascript
const config = {
    vrfCoordinator: "0x8103B0A8A00be2DDC778e6e7eaa21791Cd364625",
    gasLane: "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c", // 30 gwei
    subscriptionId: YOUR_SUBSCRIPTION_ID,
    callbackGasLimit: 500000,
    interval: 3600
}
```

---

## 🚀 **Setup Process**

### **Step 1: Create VRF Subscription**
1. Go to [vrf.chain.link](https://vrf.chain.link)
2. Click "Create Subscription"
3. Fund with LINK tokens (minimum 5 LINK recommended)
4. Note your subscription ID

### **Step 2: Deploy Contract**
```bash
npx hardhat run scripts/deploy.js --network mainnet
```

### **Step 3: Add Contract as VRF Consumer**
1. Go back to [vrf.chain.link](https://vrf.chain.link)
2. Find your subscription
3. Click "Add Consumer"
4. Enter your deployed contract address

### **Step 4: Register Chainlink Automation**
1. Go to [automation.chain.link](https://automation.chain.link)
2. Click "Register New Upkeep"
3. Choose "Custom Logic"
4. Enter your contract address
5. Fund with LINK tokens (minimum 5 LINK)
6. Set gas limit: 2,000,000
7. Set checkData: Leave empty (your server will provide raffleId)

---

## 💡 **How It Works**

### **Professional Flow (Fully Automated)**
1. **Admin creates raffle**: `createRaffleWithNFT()` → State: `CREATED`
2. **Admin activates**: `activateRaffle()` → State: `ACTIVE`  
3. **Users join**: `joinRaffle()` (validates state + timing)
4. **Server sets participants**: `setRaffleParticipants()` (before end time)
5. **Chainlink Automation**: 
   - Monitors `checkUpkeep()` every block (FREE)
   - When raffle expires, calls `performUpkeep()` (PAID ~$1-5)
6. **Chainlink VRF**: 
   - `performUpkeep()` requests randomness (PAID ~$2-4)  
   - `fulfillRandomWords()` selects winner and transfers prize
7. **Winner gets prize**: Automatic transfer

### **Server Integration**
- **For each active raffle**: Call `setRaffleParticipants()` before end time
- **Fallback**: Use `manualEndRaffle()` if automation fails
- **Monitoring**: Listen to contract events for raffle state changes

---

## 💰 **Cost Breakdown**

### **Per Raffle Costs:**
- **VRF Request**: ~$2-4 (0.25 LINK + gas)
- **Automation**: ~$1-5 (gas + 20% premium)  
- **Total per raffle**: ~$3-9

### **Monthly Costs (10 raffles/month):**
- **VRF**: ~$20-40
- **Automation**: ~$10-50
- **Total**: ~$30-90/month

### **Setup Costs (One-time):**
- **VRF Subscription**: 5+ LINK (~$50-100)
- **Automation Balance**: 5+ LINK (~$50-100)
- **Total Setup**: ~$100-200

---

## 🛠️ **Testing Commands**

```bash
# Test VRF manually
npx hardhat run scripts/test-vrf.js

# Test automation 
npx hardhat run scripts/test-automation.js

# Check raffle state
npx hardhat run scripts/check-raffle.js
```

---

## ⚠️ **Important Notes**

1. **Fund subscriptions**: Keep 5+ LINK in both VRF and Automation
2. **Gas limits**: Set callback gas limit to 500,000 minimum
3. **Monitoring**: Set up alerts when LINK balance gets low
4. **Backup**: Always have `manualEndRaffle()` as fallback
5. **Testing**: Test thoroughly on testnets before mainnet

Your contract is now **100% automated** and **trustless**! 🎉