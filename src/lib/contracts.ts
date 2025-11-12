/**
 * @file contracts.ts
 * @description Contract configuration and ABI for GamePaymentContract on Ink network
 * Provides contract address, ABI, and utility methods for interacting with the payment contract
 */

import { parseEther, formatEther } from 'viem';

/**
 * Game Payment Contract Address
 * Set via environment variable NEXT_PUBLIC_GAME_PAYMENT_CONTRACT_ADDRESS
 */
export const GAME_PAYMENT_CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_GAME_PAYMENT_CONTRACT_ADDRESS || '0x') as `0x${string}`;

/**
 * Owner Wallet Address
 * Set via environment variable NEXT_PUBLIC_OWNER_WALLET
 */
export const OWNER_WALLET_ADDRESS = (process.env.NEXT_PUBLIC_OWNER_WALLET || '0x') as `0x${string}`;

/**
 * Game Payment Contract ABI
 * Includes all public functions and events from GamePaymentContract.sol
 */
export const GAME_PAYMENT_ABI = [
  {
    inputs: [],
    stateMutability: 'nonpayable',
    type: 'constructor',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'owner',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'amount',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'timestamp',
        type: 'uint256',
      },
    ],
    name: 'FundsWithdrawn',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'player',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'amount',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'timestamp',
        type: 'uint256',
      },
    ],
    name: 'PaymentReceived',
    type: 'event',
  },
  {
    inputs: [],
    name: 'getBalance',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'owner',
    outputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'payToPlay',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalCollected',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'withdraw',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

/**
 * Complete contract configuration object for use with wagmi hooks
 */
export const GAME_PAYMENT_CONTRACT = {
  address: GAME_PAYMENT_CONTRACT_ADDRESS,
  abi: GAME_PAYMENT_ABI,
} as const;

/**
 * GamePaymentService
 * Utility class providing helper methods for contract interactions
 */
export class GamePaymentService {
  /**
   * Calculate the required ETH amount for a given USD amount
   * @param usdAmount - The USD amount to convert (e.g., 0.04)
   * @param ethPrice - Current ETH price in USD (e.g., 2500)
   * @returns The required ETH amount as a bigint in wei
   */
  static calculateRequiredEth(usdAmount: number, ethPrice: number): bigint {
    if (ethPrice <= 0) {
      throw new Error('ETH price must be greater than 0');
    }
    const ethAmount = usdAmount / ethPrice;
    return parseEther(ethAmount.toString());
  }

  /**
   * Format wei amount to ETH string with proper decimals
   * @param wei - Amount in wei as bigint
   * @returns Formatted ETH amount as string (e.g., "0.00002")
   */
  static formatEthAmount(wei: bigint): string {
    return formatEther(wei);
  }

  /**
   * Format wei amount to ETH with specified decimal places
   * @param wei - Amount in wei as bigint
   * @param decimals - Number of decimal places to show (default: 6)
   * @returns Formatted ETH amount as string
   */
  static formatEthWithDecimals(wei: bigint, decimals: number = 6): string {
    const ethAmount = formatEther(wei);
    const num = parseFloat(ethAmount);
    return num.toFixed(decimals);
  }

  /**
   * Convert ETH amount to USD
   * @param ethAmount - Amount in ETH as bigint (wei)
   * @param ethPrice - Current ETH price in USD
   * @returns USD value as number
   */
  static convertEthToUsd(ethAmount: bigint, ethPrice: number): number {
    const ethValue = parseFloat(formatEther(ethAmount));
    return ethValue * ethPrice;
  }

  /**
   * Validate contract address is set
   * @returns true if contract address is configured
   */
  static isContractConfigured(): boolean {
    return GAME_PAYMENT_CONTRACT_ADDRESS !== '0x' && GAME_PAYMENT_CONTRACT_ADDRESS.length > 2;
  }

  /**
   * Validate owner wallet address is set
   * @returns true if owner wallet address is configured
   */
  static isOwnerConfigured(): boolean {
    return OWNER_WALLET_ADDRESS !== '0x' && OWNER_WALLET_ADDRESS.length > 2;
  }

  /**
   * Check if a given address is the contract owner
   * @param address - Address to check
   * @returns true if address matches owner wallet
   */
  static isOwner(address: string): boolean {
    return address.toLowerCase() === OWNER_WALLET_ADDRESS.toLowerCase();
  }

  /**
   * Get Ink network explorer URL for a transaction
   * @param txHash - Transaction hash
   * @returns Full URL to view transaction on Ink explorer
   */
  static getExplorerTxUrl(txHash: string): string {
    return `https://explorer.inkonchain.com/tx/${txHash}`;
  }

  /**
   * Get Ink network explorer URL for an address
   * @param address - Wallet or contract address
   * @returns Full URL to view address on Ink explorer
   */
  static getExplorerAddressUrl(address: string): string {
    return `https://explorer.inkonchain.com/address/${address}`;
  }

  /**
   * Get Ink network explorer URL for the game payment contract
   * @returns Full URL to view contract on Ink explorer
   */
  static getContractExplorerUrl(): string {
    return this.getExplorerAddressUrl(GAME_PAYMENT_CONTRACT_ADDRESS);
  }
}
