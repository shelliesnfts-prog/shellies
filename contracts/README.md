# Smart Contracts

This directory contains Solidity smart contracts for the Shellies Game platform.

## Setup

The project uses Hardhat for smart contract development, testing, and deployment.

### Prerequisites

- Node.js v18 or higher
- npm or yarn
- A wallet with ETH on Ink network for deployment

### Installation

Dependencies are already installed as part of the main project. If you need to reinstall:

```bash
npm install
```

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and fill in the required values:

```env
# Required for deployment
PRIVATE_KEY=your-private-key-for-deployment

# Network RPC URLs (defaults provided)
INK_TESTNET_RPC_URL=https://rpc-gel-sepolia.inkonchain.com
INK_MAINNET_RPC_URL=https://rpc-gel.inkonchain.com

# Explorer API key (optional, for contract verification)
INK_EXPLORER_API_KEY=no-api-key-needed
```

**⚠️ Security Warning:** Never commit your `.env` file or expose your private key!

## Available Networks

- **hardhat**: Local Hardhat network for testing (Chain ID: 31337)
- **inkTestnet**: Ink Sepolia testnet (Chain ID: 763373)
- **inkMainnet**: Ink mainnet (Chain ID: 57073)

## Commands

### Compile Contracts

```bash
npm run hardhat:compile
```

### Run Tests

```bash
npm run hardhat:test
```

### Deploy Contracts

#### Local Hardhat Network

```bash
npm run deploy:local
```

#### Ink Testnet

```bash
npm run deploy:ink-testnet
```

#### Ink Mainnet

```bash
npm run deploy:ink-mainnet
```

### Start Local Node

```bash
npm run hardhat:node
```

## Deployment Process

1. **Prepare Environment**
   - Ensure you have ETH in your wallet for gas fees
   - Set `PRIVATE_KEY` in `.env` file
   - Verify network RPC URLs are correct

2. **Test Locally First**
   ```bash
   npm run hardhat:compile
   npm run hardhat:test
   npm run deploy:local
   ```

3. **Deploy to Testnet**
   ```bash
   npm run deploy:ink-testnet
   ```
   - Test all contract functions on testnet
   - Verify contract on Ink Explorer

4. **Deploy to Mainnet**
   ```bash
   npm run deploy:ink-mainnet
   ```
   - Save the contract address
   - Update `.env` with `NEXT_PUBLIC_GAME_PAYMENT_CONTRACT`
   - Update `.env` with `NEXT_PUBLIC_OWNER_WALLET`

5. **Verify Contract (Optional)**
   ```bash
   npx hardhat verify --network inkMainnet <CONTRACT_ADDRESS>
   ```

## Contract Addresses

After deployment, update your `.env` file:

```env
NEXT_PUBLIC_GAME_PAYMENT_CONTRACT=<deployed_contract_address>
NEXT_PUBLIC_OWNER_WALLET=<your_wallet_address>
```

## Ink Network Details

### Testnet (Sepolia)
- Chain ID: 763373
- RPC URL: https://rpc-gel-sepolia.inkonchain.com
- Explorer: https://explorer-sepolia.inkonchain.com

### Mainnet
- Chain ID: 57073
- RPC URL: https://rpc-gel.inkonchain.com
- Explorer: https://explorer.inkonchain.com

## Troubleshooting

### "Insufficient funds" error
- Ensure your wallet has enough ETH for gas fees
- Get testnet ETH from Ink Sepolia faucet

### "Invalid nonce" error
- Reset your account nonce in MetaMask: Settings > Advanced > Reset Account

### "Network not found" error
- Verify RPC URLs in `hardhat.config.ts`
- Check your internet connection

## Resources

- [Hardhat Documentation](https://hardhat.org/docs)
- [Ink Network Documentation](https://docs.inkonchain.com)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts)
