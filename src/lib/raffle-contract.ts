import { createPublicClient, createWalletClient, http, erc20Abi, erc721Abi, parseEther } from 'viem';
import { defineChain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { raffle_abi } from './raffle-abi';

// Ink chain configuration (mainnet)
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
    },
  },
  testnet: false,
});

// Create Viem client for Ink blockchain
const publicClient = createPublicClient({
  chain: inkChain,
  transport: http('https://rpc-gel.inkonchain.com', {
    timeout: 3000,
    retryCount: 2,
    retryDelay: 500
  })
});

// Create server wallet client (server-side only)
function createServerWalletClient() {
  const serverPrivateKey = process.env.SERVER_WALLET_PRIVATE_KEY;
  if (!serverPrivateKey) {
    throw new Error('SERVER_WALLET_PRIVATE_KEY environment variable is required');
  }
  
  // Ensure the private key is in the correct format (0x prefixed)
  const formattedPrivateKey = serverPrivateKey.startsWith('0x') 
    ? serverPrivateKey 
    : `0x${serverPrivateKey}`;
  
  const account = privateKeyToAccount(formattedPrivateKey as `0x${string}`);
  
  return createWalletClient({
    account,
    chain: inkChain,
    transport: http('https://rpc-gel.inkonchain.com', {
      timeout: 10000,
      retryCount: 3,
      retryDelay: 1000
    })
  });
}

// Use the compiled ABI from Remix
const raffleContractAbi = raffle_abi;

// Use built-in viem ABIs for ERC20 and ERC721
// erc20Abi and erc721Abi are imported from viem above

export interface PrizeToken {
  address: string;
  type: 'NFT' | 'ERC20';
  tokenId?: string; // For NFTs
  amount?: string; // For ERC20s
  symbol?: string;
  name?: string;
  decimals?: number;
}

export interface RaffleData {
  title: string;
  description: string;
  image_url?: string;
  points_per_ticket: number;
  max_tickets_per_user: number;
  max_participants?: number;
  end_date: string;
  prize: PrizeToken;
}

export class RaffleContractService {
  private static contractAddress: string = process.env.NEXT_PUBLIC_RAFFLE_CONTRACT_ADDRESS || '';

  /**
   * Convert database ID to contract raffle ID
   * Now using sequential IDs - no conversion needed!
   */
  static generateRaffleId(databaseId: string | number): number {
    // Database ID is a sequential number, use it directly
    return typeof databaseId === 'string' ? parseInt(databaseId) : databaseId;
  }

  /**
   * Check if user owns the NFT token
   */
  static async checkNFTOwnership(
    userAddress: string, 
    tokenAddress: string, 
    tokenId: string
  ): Promise<boolean> {
    try {
      const owner = await publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: erc721Abi,
        functionName: 'ownerOf',
        args: [BigInt(tokenId)],
      });
      
      return owner.toLowerCase() === userAddress.toLowerCase();
    } catch (error) {
      console.error('Error checking NFT ownership:', error);
      return false;
    }
  }

  /**
   * Check if user has enough ERC20 tokens
   */
  static async checkERC20Balance(
    userAddress: string, 
    tokenAddress: string, 
    amount: string
  ): Promise<boolean> {
    try {
      const balance = await publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [userAddress as `0x${string}`],
      });
      
      return balance >= BigInt(amount);
    } catch (error) {
      console.error('Error checking ERC20 balance:', error);
      return false;
    }
  }

  /**
   * Get ERC20 token info
   */
  static async getERC20Info(tokenAddress: string): Promise<{
    name: string;
    symbol: string;
    decimals: number;
  } | null> {
    try {
      const [name, symbol, decimals] = await Promise.all([
        publicClient.readContract({
          address: tokenAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: 'name',
        }),
        publicClient.readContract({
          address: tokenAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: 'symbol',
        }),
        publicClient.readContract({
          address: tokenAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: 'decimals',
        }),
      ]);

      return {
        name: name as string,
        symbol: symbol as string,
        decimals: decimals as number,
      };
    } catch (error) {
      console.error('Error getting ERC20 info:', error);
      return null;
    }
  }

  /**
   * Get NFT token URI
   */
  static async getNFTTokenURI(tokenAddress: string, tokenId: string): Promise<string | null> {
    try {
      const tokenURI = await publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: erc721Abi,
        functionName: 'tokenURI',
        args: [BigInt(tokenId)],
      });
      
      return tokenURI as string;
    } catch (error) {
      console.error('Error getting NFT token URI:', error);
      return null;
    }
  }

  /**
   * Check if NFT is approved for the raffle contract
   */
  static async isNFTApproved(
    userAddress: string,
    tokenAddress: string, 
    tokenId: string
  ): Promise<boolean> {
    try {
      const [approvedAddress, isApprovedForAll] = await Promise.all([
        publicClient.readContract({
          address: tokenAddress as `0x${string}`,
          abi: erc721Abi,
          functionName: 'getApproved',
          args: [BigInt(tokenId)],
        }),
        publicClient.readContract({
          address: tokenAddress as `0x${string}`,
          abi: erc721Abi,
          functionName: 'isApprovedForAll',
          args: [userAddress as `0x${string}`, this.contractAddress as `0x${string}`],
        })
      ]);

      return (
        approvedAddress.toLowerCase() === this.contractAddress.toLowerCase() ||
        isApprovedForAll === true
      );
    } catch (error) {
      console.error('Error checking NFT approval:', error);
      return false;
    }
  }

  /**
   * Check if ERC20 is approved for the raffle contract
   */
  static async isERC20Approved(
    userAddress: string,
    tokenAddress: string, 
    amount: string
  ): Promise<boolean> {
    try {
      const allowance = await publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [userAddress as `0x${string}`, this.contractAddress as `0x${string}`],
      });

      return allowance >= BigInt(amount);
    } catch (error) {
      console.error('Error checking ERC20 approval:', error);
      return false;
    }
  }

  /**
   * Get raffle prize info from contract
   */
  static async getRafflePrizeInfo(raffleId: string): Promise<{
    prizeToken: string;
    prizeTokenId: string;
    isNFT: boolean;
    deposited: boolean;
    winner: string;
    completed: boolean;
  } | null> {
    try {
      if (!this.contractAddress) {
        console.error('Raffle contract address not configured');
        return null;
      }

      const result = await publicClient.readContract({
        address: this.contractAddress as `0x${string}`,
        abi: raffleContractAbi,
        functionName: 'getRafflePrize',
        args: [BigInt(raffleId)],
      });

      const [prizeToken, prizeTokenId, isNFT, deposited, winner, completed] = result as [
        string, bigint, boolean, boolean, string, boolean
      ];

      return {
        prizeToken,
        prizeTokenId: prizeTokenId.toString(),
        isNFT,
        deposited,
        winner,
        completed,
      };
    } catch (error) {
      console.error('Error getting raffle prize info:', error);
      return null;
    }
  }

  /**
   * Check if raffle prize is deposited on contract
   */
  static async rafflePrizeDeposited(raffleId: string): Promise<boolean> {
    try {
      if (!this.contractAddress) return false;

      const prizeInfo = await this.getRafflePrizeInfo(raffleId);
      return prizeInfo?.deposited || false;
    } catch (error) {
      console.error('Error checking if raffle prize is deposited:', error);
      return false;
    }
  }

  /**
   * Validate if an address looks like a valid Ethereum address
   */
  static isValidAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  /**
   * Convert end date to timestamp
   */
  static dateToTimestamp(dateString: string): number {
    return Math.floor(new Date(dateString).getTime() / 1000);
  }

  /**
   * Helper function to get the blockchain raffle ID from database ID
   * Use this to find the correct raffle ID for contract calls
   */
  static getBlockchainRaffleId(databaseId: string | number): number {
    return this.generateRaffleId(databaseId);
  }

  /**
   * Helper function - no conversion needed with sequential IDs
   * Database ID and blockchain ID are the same now
   */
  static getDatabaseIdFromBlockchainId(blockchainRaffleId: number): number {
    return blockchainRaffleId;
  }

  // ============ SERVER-SIDE CONTRACT INTERACTIONS ============

  /**
   * SERVER ONLY: Create raffle with NFT on blockchain
   */
  static async serverCreateRaffleWithNFT(
    raffleId: number,
    prizeTokenAddress: string,
    tokenId: string,
    endTimestamp: number
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      if (!this.contractAddress) {
        return { success: false, error: 'Raffle contract address not configured' };
      }

      const walletClient = createServerWalletClient();
      
      // First approve NFT for the contract
      const approveHash = await walletClient.writeContract({
        address: prizeTokenAddress as `0x${string}`,
        abi: erc721Abi,
        functionName: 'approve',
        args: [this.contractAddress as `0x${string}`, BigInt(tokenId)],
      });

      console.log('NFT approve transaction:', approveHash);
      
      // Wait for approval to be mined with better error handling
      try {
        await publicClient.waitForTransactionReceipt({ 
          hash: approveHash,
          timeout: 30000, // 30 seconds timeout
          pollingInterval: 2000 // Check every 2 seconds
        });
      } catch (receiptError) {
        console.warn('Error waiting for approve receipt, continuing anyway:', receiptError);
        // Continue with a delay instead of failing
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

      // Create raffle on contract
      const raffleHash = await walletClient.writeContract({
        address: this.contractAddress as `0x${string}`,
        abi: raffleContractAbi,
        functionName: 'createRaffleWithNFT',
        args: [
          BigInt(raffleId),
          prizeTokenAddress as `0x${string}`,
          BigInt(tokenId),
          BigInt(endTimestamp)
        ],
      });

      console.log('Create raffle transaction:', raffleHash);
      
      // Wait for transaction to be mined with better error handling
      try {
        await publicClient.waitForTransactionReceipt({ 
          hash: raffleHash,
          timeout: 30000, // 30 seconds timeout
          pollingInterval: 2000 // Check every 2 seconds
        });
      } catch (receiptError) {
        console.warn('Error waiting for create raffle receipt, continuing anyway:', receiptError);
        // Continue with a delay instead of failing
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

      return { success: true, txHash: raffleHash };
    } catch (error) {
      console.error('Error creating NFT raffle on blockchain:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown blockchain error' 
      };
    }
  }

  /**
   * SERVER ONLY: Create raffle with ERC20 on blockchain
   */
  static async serverCreateRaffleWithToken(
    raffleId: number,
    prizeTokenAddress: string,
    amount: string,
    endTimestamp: number
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      if (!this.contractAddress) {
        return { success: false, error: 'Raffle contract address not configured' };
      }

      const walletClient = createServerWalletClient();
      
      // First approve ERC20 tokens for the contract
      const approveHash = await walletClient.writeContract({
        address: prizeTokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: 'approve',
        args: [this.contractAddress as `0x${string}`, BigInt(amount)],
      });

      console.log('ERC20 approve transaction:', approveHash);
      
      // Wait for approval to be mined with better error handling
      try {
        await publicClient.waitForTransactionReceipt({ 
          hash: approveHash,
          timeout: 30000, // 30 seconds timeout
          pollingInterval: 2000 // Check every 2 seconds
        });
      } catch (receiptError) {
        console.warn('Error waiting for ERC20 approve receipt, continuing anyway:', receiptError);
        // Continue with a delay instead of failing
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

      // Create raffle on contract
      const raffleHash = await walletClient.writeContract({
        address: this.contractAddress as `0x${string}`,
        abi: raffleContractAbi,
        functionName: 'createRaffleWithToken',
        args: [
          BigInt(raffleId),
          prizeTokenAddress as `0x${string}`,
          BigInt(amount),
          BigInt(endTimestamp)
        ],
      });

      console.log('Create raffle transaction:', raffleHash);
      
      // Wait for transaction to be mined with better error handling
      try {
        await publicClient.waitForTransactionReceipt({ 
          hash: raffleHash,
          timeout: 30000, // 30 seconds timeout
          pollingInterval: 2000 // Check every 2 seconds
        });
      } catch (receiptError) {
        console.warn('Error waiting for ERC20 create raffle receipt, continuing anyway:', receiptError);
        // Continue with a delay instead of failing
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

      return { success: true, txHash: raffleHash };
    } catch (error) {
      console.error('Error creating ERC20 raffle on blockchain:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown blockchain error' 
      };
    }
  }

  /**
   * SERVER ONLY: Activate raffle on blockchain
   */
  static async serverActivateRaffle(raffleId: number): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      if (!this.contractAddress) {
        return { success: false, error: 'Raffle contract address not configured' };
      }

      const walletClient = createServerWalletClient();
      
      const txHash = await walletClient.writeContract({
        address: this.contractAddress as `0x${string}`,
        abi: raffleContractAbi,
        functionName: 'activateRaffle',
        args: [BigInt(raffleId)],
      });

      console.log('Activate raffle transaction:', txHash);
      
      // Wait for transaction to be mined with better error handling
      try {
        await publicClient.waitForTransactionReceipt({ 
          hash: txHash,
          timeout: 30000, // 30 seconds timeout
          pollingInterval: 2000 // Check every 2 seconds
        });
      } catch (receiptError) {
        console.warn('Error waiting for activate raffle receipt, continuing anyway:', receiptError);
        // Continue with a delay instead of failing
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

      return { success: true, txHash };
    } catch (error) {
      console.error('Error activating raffle on blockchain:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown blockchain error' 
      };
    }
  }

  /**
   * SERVER ONLY: Create and activate raffle in one go
   */
  static async serverCreateAndActivateRaffle(
    databaseId: string | number,
    prizeTokenAddress: string,
    prizeTokenType: 'NFT' | 'ERC20',
    prizeTokenId: string | null,
    prizeAmount: string | null,
    endDate: string
  ): Promise<{ success: boolean; txHashes?: string[]; error?: string }> {
    try {
      const raffleId = this.generateRaffleId(databaseId);
      const endTimestamp = this.dateToTimestamp(endDate);
      
      let createResult;
      
      if (prizeTokenType === 'NFT' && prizeTokenId) {
        createResult = await this.serverCreateRaffleWithNFT(
          raffleId,
          prizeTokenAddress,
          prizeTokenId,
          endTimestamp
        );
      } else if (prizeTokenType === 'ERC20' && prizeAmount) {
        createResult = await this.serverCreateRaffleWithToken(
          raffleId,
          prizeTokenAddress,
          prizeAmount,
          endTimestamp
        );
      } else {
        return { success: false, error: 'Invalid prize configuration' };
      }

      if (!createResult.success) {
        return createResult;
      }

      // Activate the raffle
      const activateResult = await this.serverActivateRaffle(raffleId);
      
      if (!activateResult.success) {
        return activateResult;
      }

      return { 
        success: true, 
        txHashes: [createResult.txHash!, activateResult.txHash!] 
      };
    } catch (error) {
      console.error('Error creating and activating raffle:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * SERVER ONLY: End a raffle (picks winner and distributes prize)
   */
  static async serverEndRaffle(
    databaseId: string | number
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      if (!this.contractAddress) {
        return { success: false, error: 'Raffle contract address not configured' };
      }

      const raffleId = this.generateRaffleId(databaseId);
      
      // Fetch participants and their ticket counts from database
      const { supabaseAdmin, supabase } = await import('./supabase');
      const client = supabaseAdmin || supabase;
      
      const { data: entries, error: entriesError } = await client
        .from('shellies_raffle_entries')
        .select('wallet_address, ticket_count')
        .eq('raffle_id', databaseId);

      if (entriesError || !entries || entries.length === 0) {
        return { success: false, error: 'No participants found for this raffle' };
      }

      // Aggregate ticket counts by wallet address (in case there are multiple entries per user)
      const participantMap = new Map<string, number>();
      entries.forEach(entry => {
        const current = participantMap.get(entry.wallet_address) || 0;
        participantMap.set(entry.wallet_address, current + entry.ticket_count);
      });

      // Convert to arrays for the smart contract
      const participants = Array.from(participantMap.keys()) as `0x${string}`[];
      const ticketCounts = Array.from(participantMap.values()).map(count => BigInt(count));
      
      // Generate a random seed for winner selection
      const randomSeed = BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));
      
      const serverWalletClient = createServerWalletClient();
      
      // Call endRaffle on the smart contract with all required parameters
      const txHash = await serverWalletClient.writeContract({
        address: this.contractAddress as `0x${string}`,
        abi: raffle_abi,
        functionName: 'endRaffle',
        args: [raffleId, participants, ticketCounts, randomSeed],
      });

      console.log('End raffle transaction submitted:', txHash);
      
      // Wait for transaction confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ 
        hash: txHash,
        timeout: 30000
      });
      
      if (receipt.status === 'success') {
        console.log('Raffle ended successfully:', receipt);
        return { success: true, txHash };
      } else {
        console.error('End raffle transaction failed:', receipt);
        return { success: false, error: 'Transaction failed' };
      }
    } catch (error) {
      console.error('Error ending raffle:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}

// Export contract address for use in other components
export const RAFFLE_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_RAFFLE_CONTRACT_ADDRESS || '';