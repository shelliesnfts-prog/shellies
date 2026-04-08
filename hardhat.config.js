require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY || "";
const INK_MAINNET_RPC_URL = process.env.INK_MAINNET_RPC_URL || "https://rpc-gel.inkonchain.com";
const INK_TESTNET_RPC_URL = process.env.INK_TESTNET_RPC_URL || "https://rpc-gel-sepolia.inkonchain.com";
const BLOCKSCOUT_API_KEY = process.env.INK_EXPLORER_API_KEY || "no-api-key-needed";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },

  // Only compile contracts in the hardhat subfolder to avoid GitHub-URL imports
  paths: {
    sources: "./contracts/hardhat",
    artifacts: "./artifacts",
    cache: "./cache",
  },

  networks: {
    // Ink Mainnet
    ink: {
      url: INK_MAINNET_RPC_URL,
      chainId: 57073,
      accounts: DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [],
    },
    // Ink Sepolia Testnet
    inkSepolia: {
      url: INK_TESTNET_RPC_URL,
      chainId: 763373,
      accounts: DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [],
    },
  },

  etherscan: {
    apiKey: {
      ink: BLOCKSCOUT_API_KEY,
      inkSepolia: BLOCKSCOUT_API_KEY,
    },
    customChains: [
      {
        network: "ink",
        chainId: 57073,
        urls: {
          apiURL: "https://explorer.inkonchain.com/api",
          browserURL: "https://explorer.inkonchain.com",
        },
      },
      {
        network: "inkSepolia",
        chainId: 763373,
        urls: {
          apiURL: "https://explorer-sepolia.inkonchain.com/api",
          browserURL: "https://explorer-sepolia.inkonchain.com",
        },
      },
    ],
  },
};
