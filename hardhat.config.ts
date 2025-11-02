import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-verify";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    // Ink Testnet
    inkTestnet: {
      type: "http",
      url: process.env.INK_TESTNET_RPC_URL || "https://rpc-gel-sepolia.inkonchain.com",
      chainId: 763373,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    // Ink Mainnet
    inkMainnet: {
      type: "http",
      url: process.env.INK_MAINNET_RPC_URL || "https://rpc-gel.inkonchain.com",
      chainId: 57073,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    // Local Hardhat network for testing
    hardhat: {
      url: "",
      type: "http",
      chainId: 31337,
    },
  },
  etherscan: {
    apiKey: {
      inkTestnet: process.env.INK_EXPLORER_API_KEY || "no-api-key-needed",
      inkMainnet: process.env.INK_EXPLORER_API_KEY || "no-api-key-needed",
    },
    customChains: [
      {
        network: "inkTestnet",
        chainId: 763373,
        urls: {
          apiURL: "https://explorer-sepolia.inkonchain.com/api",
          browserURL: "https://explorer-sepolia.inkonchain.com",
        },
      },
      {
        network: "inkMainnet",
        chainId: 57073,
        urls: {
          apiURL: "https://explorer.inkonchain.com/api",
          browserURL: "https://explorer.inkonchain.com",
        },
      },
    ],
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

export default config;
