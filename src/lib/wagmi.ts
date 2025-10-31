import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { defineChain } from 'viem';
import { http } from 'viem';
import type { Config } from 'wagmi';

// Polyfill localStorage for SSR to prevent WalletConnect errors
if (typeof window === 'undefined') {
  // @ts-ignore
  global.localStorage = {
    getItem: () => null,
    setItem: () => { },
    removeItem: () => { },
    clear: () => { },
    key: () => null,
    length: 0,
  };
}

// Define Ink chain configuration (mainnet)
const inkChain = defineChain({
  id: 57073,
  name: 'Ink',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://rpc-gel.inkonchain.com'],
      webSocket: ['wss://rpc-gel.inkonchain.com'],
    },
    public: {
      http: ['https://rpc-gel.inkonchain.com', 'https://rpc-qnd.inkonchain.com'],
      webSocket: ['wss://rpc-gel.inkonchain.com', 'wss://rpc-qnd.inkonchain.com'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Ink Explorer',
      url: 'https://explorer.inkonchain.com',
      apiUrl: 'https://explorer.inkonchain.com/api'
    },
  },
  testnet: false,
});

// Create config once to avoid multiple initializations
let _config: Config | undefined;

export const getConfig = (): Config => {
  if (!_config) {
    _config = getDefaultConfig({
      appName: 'Shellies Raffles',
      projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || 'placeholder-project-id',
      // Only include Ink chain - this makes all other chains show as "unsupported"
      chains: [inkChain],
      transports: {
        [inkChain.id]: http(),
      },
      ssr: true,
      // Enable multiInjectedProviderDiscovery for better wallet detection
      multiInjectedProviderDiscovery: true,
    });
  }
  return _config;
};

// Export the Ink chain for use in components
export { inkChain };

// Export config - only create on client side
export const config = typeof window !== 'undefined' ? getConfig() : {} as Config;