import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { mainnet, polygon } from 'wagmi/chains';
import { defineChain } from 'viem';

// Define Ink chain configuration
const inkChain = defineChain({
  id: 57073,
  name: 'Ink Sepolia',
  nativeCurrency: {
    decimals: 18,
    name: 'INK',
    symbol: 'INK',
  },
  rpcUrls: {
    default: {
      http: ['https://rpc-gel-sepolia.inkonchain.com'],
    },
  },
  blockExplorers: {
    default: { 
      name: 'Ink Explorer', 
      url: 'https://explorer-sepolia.inkonchain.com',
      apiUrl: 'https://explorer-sepolia.inkonchain.com/api'
    },
  },
  testnet: true,
});

export const config = getDefaultConfig({
  appName: 'Shellies Raffles',
  projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || 'placeholder-project-id',
  chains: [inkChain, mainnet, polygon],
  ssr: true,
});