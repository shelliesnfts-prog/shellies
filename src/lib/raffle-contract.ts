import { createPublicClient, createWalletClient, http, erc20Abi, erc721Abi, parseEther } from 'viem';
import { defineChain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { raffle_abi } from './raffle-abi';
import { new_raffle_abi } from './newRaffle_contract_abi';
import type { Raffle } from './supabase';

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

  // Create public client for reading transaction receipts
  private static publicClient = createPublicClient({
    chain: inkChain,
    transport: http()
  });

  /**
   * Resolve which raffle contract address to use for a given raffle row.
   *
   * After the new (held-NFT-only) contract is deployed, NEXT_PUBLIC_RAFFLE_CONTRACT_ADDRESS
   * points to the NEW address. Old raffles still have their prizes escrowed in the
   * previous deployment — those rows carry the previous address in `contract_address`
   * (backfilled by migration 032). Always route end/refund/getInfo through this helper.
   */
  static getContractAddressForRaffle(raffle: Pick<Raffle, 'contract_address'> | { contract_address?: string | null }): string {
    return (raffle?.contract_address as string | undefined) || this.contractAddress;
  }

  /**
   * Wait for transaction receipt and verify success
   * @param txHash - Transaction hash to wait for
   * @returns Promise that resolves when transaction is confirmed
   */
  private static async waitForTransactionReceipt(txHash: string): Promise<{ success: boolean; error?: string }> {
    try {
      
      const receipt = await this.publicClient.waitForTransactionReceipt({ 
        hash: txHash as `0x${string}`,
        timeout: 60000 // 60 second timeout
      });
      
      
      if (receipt.status === 'success') {
        return { success: true };
      } else {
        // Transaction failed - try to get more details
        let errorMessage = 'Transaction reverted on blockchain';
        
        try {
          // Try to get the transaction and simulate it to get revert reason
          const transaction = await this.publicClient.getTransaction({ 
            hash: txHash as `0x${string}` 
          });
          
          if (transaction) {
            
            try {
              // Try to simulate the transaction to get the revert reason
              await this.publicClient.call({
                account: transaction.from,
                to: transaction.to,
                data: transaction.input,
                value: transaction.value
              });
            } catch (simulationError: any) {
              
              // Extract revert reason from simulation error
              if (simulationError?.details) {
                errorMessage = `Transaction failed: ${simulationError.details}`;
              } else if (simulationError?.message) {
                // Look for common error patterns
                if (simulationError.message.includes('Raffle already exists')) {
                  errorMessage = 'This raffle ID already exists on the blockchain. Please try again.';
                } else if (simulationError.message.includes('Invalid amount') || simulationError.message.includes('Amount too large')) {
                  errorMessage = 'Invalid token amount. Please check the amount and try again.';
                } else if (simulationError.message.includes('Admin only')) {
                  errorMessage = 'Admin permission required. Please check your admin status.';
                } else if (simulationError.message.includes('Invalid token')) {
                  errorMessage = 'Invalid token address. Please verify the token contract.';
                } else if (simulationError.message.includes('transferFrom failed') || simulationError.message.includes('ERC20: transfer amount exceeds allowance')) {
                  errorMessage = 'Token transfer failed. Please check token allowance and balance.';
                } else if (simulationError.message.includes('Trading not enabled') || simulationError.message.includes('_update::Trading')) {
                  errorMessage = 'Token transfers are currently disabled by the token contract. Please use a different token or contact the token issuer to enable trading.';
                } else if (simulationError.message.includes('block is out of range')) {
                  // For RPC simulation issues, provide a helpful message about the token
                  errorMessage = 'Transaction failed on blockchain. This is likely due to token transfer restrictions. Please verify the token allows transfers and try with a different token if needed.';
                } else {
                  errorMessage = `Transaction failed: ${simulationError.message}`;
                }
              }
            }
          }
        } catch (detailError) {
        }
        
        return { 
          success: false, 
          error: errorMessage
        };
      }
    } catch (error) {
      console.error('Error waiting for transaction receipt:', error);
      
      // Handle specific timeout errors
      if (error instanceof Error && error.message.includes('timeout')) {
        return { 
          success: false, 
          error: 'Transaction confirmation timed out. Please check the blockchain explorer to verify if it was successful.' 
        };
      }
      
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Transaction verification failed' 
      };
    }
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

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
   * Get raffle prize info from contract.
   * @param raffleId   On-chain raffle id (same as DB id).
   * @param contractAddress  Optional override — if provided, reads from that contract
   *                          (used for raffles escrowed on the previous deployment).
   *                          Defaults to current env contract address.
   */
  static async getRafflePrizeInfo(
    raffleId: string,
    contractAddress?: string
  ): Promise<{
    prizeToken: string;
    prizeTokenId: string;
    isNFT: boolean;
    state: number;
    winner: string;
  } | null> {
    try {
      const targetAddress = contractAddress || this.contractAddress;
      if (!targetAddress) {
        console.error('Raffle contract address not configured');
        return null;
      }

      const result = await publicClient.readContract({
        address: targetAddress as `0x${string}`,
        abi: raffleContractAbi,
        functionName: 'getRaffleInfo',
        args: [BigInt(raffleId)],
      });

      const [prizeToken, prizeTokenId, state, isNFT, winner] = result as unknown as [
        string, bigint, number, boolean, string
      ];

      return {
        prizeToken,
        prizeTokenId: prizeTokenId.toString(),
        isNFT,
        state,
        winner,
      };
    } catch (error) {
      console.error('Error getting raffle prize info:', error);
      return null;
    }
  }

  /**
   * Get raffle prize info from OLD contract (backward compatibility for raffles 98-108)
   * Old contract address: 0xE757e8Aa82b7AD9f1ef8D4fE657d90341885c0De
   */
  static async getRafflePrizeInfoFromOldContract(raffleId: string): Promise<{
    prizeToken: string;
    prizeTokenId: string;
    isNFT: boolean;
    state: number;
    winner: string;
  } | null> {
    try {
      const oldContractAddress = '0xE757e8Aa82b7AD9f1ef8D4fE657d90341885c0De';

      const result = await publicClient.readContract({
        address: oldContractAddress as `0x${string}`,
        abi: raffleContractAbi,
        functionName: 'getRaffleInfo',
        args: [BigInt(raffleId)],
      });

      const [prizeToken, prizeTokenId, state, isNFT, winner] = result as unknown as [
        string, bigint, number, boolean, string
      ];

      return {
        prizeToken,
        prizeTokenId: prizeTokenId.toString(),
        isNFT,
        state,
        winner,
      };
    } catch (error) {
      console.error('Error getting raffle prize info from old contract:', error);
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
      // State 1 (ACTIVE) or higher typically indicates prize is deposited
      return prizeInfo ? prizeInfo.state >= 1 : false;
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
   * @deprecated Phase 3: This method has been removed in favor of admin wallet deployment
   * Use adminCreateRaffleWithNFT instead
   * Server wallet methods are no longer supported for security reasons
   */
  static async serverCreateRaffleWithNFT(
    raffleId: number,
    prizeTokenAddress: string,
    tokenId: string,
    endTimestamp: number
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    // Phase 3: Method deprecated - return error instead of executing
    
    return {
      success: false,
      error: 'Server wallet NFT raffle creation has been deprecated. Please use adminCreateRaffleWithNFT for better security and control.'
    };
  }

  /**
   * @deprecated Phase 3: This method has been removed in favor of admin wallet deployment
   * Use adminCreateRaffleWithToken instead
   * Server wallet methods are no longer supported for security reasons
   */
  static async serverCreateRaffleWithToken(
    raffleId: number,
    prizeTokenAddress: string,
    amount: string,
    endTimestamp: number
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    // Phase 3: Method deprecated - return error instead of executing
    
    return {
      success: false,
      error: 'Server wallet ERC20 raffle creation has been deprecated. Please use adminCreateRaffleWithToken for better security and control.'
    };
  }

  /**
   * @deprecated Phase 3: This method has been removed in favor of admin wallet deployment
   * Use adminActivateRaffle instead
   * Server wallet methods are no longer supported for security reasons
   */
  static async serverActivateRaffle(raffleId: number): Promise<{ success: boolean; txHash?: string; error?: string }> {
    // Phase 3: Method deprecated - return error instead of executing
    
    return {
      success: false,
      error: 'Server wallet raffle activation has been deprecated. Please use adminActivateRaffle for better security and control.'
    };
  }

  // Phase 3: Removed duplicate serverCreateAndActivateRaffle method

  /**
   * SERVER ONLY: End a raffle (picks winner and distributes prize).
   * Resolves contract address per-raffle so prizes escrowed on the previous
   * deployment can still be ended after the new contract takes over the env var.
   */
  static async serverEndRaffle(
    databaseId: string | number
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      const raffleId = this.generateRaffleId(databaseId);

      // Fetch participants AND the raffle row (for contract_address routing)
      const { supabaseAdmin, supabase } = await import('./supabase');
      const client = supabaseAdmin || supabase;

      const [{ data: entries, error: entriesError }, { data: raffleRow, error: raffleRowError }] = await Promise.all([
        client
          .from('shellies_raffle_entries')
          .select('wallet_address, ticket_count')
          .eq('raffle_id', databaseId),
        client
          .from('shellies_raffle_raffles')
          .select('contract_address')
          .eq('id', databaseId)
          .single(),
      ]);

      if (raffleRowError || !raffleRow) {
        return { success: false, error: 'Raffle not found in database' };
      }

      const targetAddress = this.getContractAddressForRaffle(raffleRow as { contract_address?: string });
      if (!targetAddress) {
        return { success: false, error: 'Raffle contract address not configured' };
      }

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

      // endRaffle signature is identical on both old and new contracts — raffle_abi covers both
      const txHash = await serverWalletClient.writeContract({
        address: targetAddress as `0x${string}`,
        abi: raffle_abi,
        functionName: 'endRaffle',
        args: [BigInt(raffleId), participants, ticketCounts, randomSeed],
      });

      
      // Wait for transaction confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ 
        hash: txHash,
        timeout: 30000
      });
      
      if (receipt.status === 'success') {
        // Update database status to COMPLETED after successful blockchain end
        try {
          const { supabaseAdmin, supabase } = await import('./supabase');
          const client = supabaseAdmin || supabase;
          
          const { error } = await client
            .from('shellies_raffle_raffles')
            .update({ status: 'COMPLETED' })
            .eq('id', databaseId);

          if (error) {
            console.error('Error updating raffle status to COMPLETED:', error);
          }
        } catch (error) {
          console.error('Error updating database status:', error);
        }

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

  // ============ ADMIN WALLET CLIENT-SIDE METHODS ============
  // These methods are for admin wallet direct interactions (Phase 1 migration)

  /**
   * ADMIN WALLET: Create raffle with NFT on blockchain (client-side)
   * Admin wallet directly interacts with the contract
   */
  static async adminCreateRaffleWithNFT(
    raffleId: number,
    prizeTokenAddress: string,
    tokenId: string,
    pointsPerTicket: number,
    writeContract: any // wagmi writeContract function
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      if (!this.contractAddress) {
        return { success: false, error: 'Raffle contract address not configured' };
      }

      // Call the contract method directly (admin wallet will be prompted to sign)
      // Use createAndActivateNFTRaffle since it combines create + activate in one transaction
      const txHash = await writeContract({
        address: this.contractAddress as `0x${string}`,
        abi: raffleContractAbi,
        functionName: 'createAndActivateNFTRaffle',
        args: [
          BigInt(raffleId),
          prizeTokenAddress as `0x${string}`,
          BigInt(tokenId),
          BigInt(pointsPerTicket),
        ],
      });

      return { success: true, txHash };
    } catch (error) {
      console.error('Error in admin NFT raffle creation:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown blockchain error' 
      };
    }
  }

  /**
   * ADMIN WALLET: Create raffle with ERC20 on blockchain (client-side)
   * Admin wallet directly interacts with the contract
   */
  static async adminCreateRaffleWithToken(
    raffleId: number,
    prizeTokenAddress: string,
    amount: string,
    pointsPerTicket: number,
    writeContract: any // wagmi writeContract function
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      if (!this.contractAddress) {
        return { success: false, error: 'Raffle contract address not configured' };
      }


      // Call the contract method directly (admin wallet will be prompted to sign)
      // Use createAndActivateTokenRaffle since it combines create + activate in one transaction
      
      // Ensure proper BigInt conversion for large numbers
      let amountBigInt: bigint;
      try {
        amountBigInt = BigInt(amount);
      } catch (error) {
        console.error('Error converting amount to BigInt:', amount, error);
        throw new Error(`Invalid amount format: ${amount}`);
      }
      

      // Pre-flight checks before calling the contract
      try {
        
        // Check if raffle already exists
        const existingRaffle = await this.publicClient.readContract({
          address: this.contractAddress as `0x${string}`,
          abi: raffleContractAbi,
          functionName: 'getRaffleInfo',
          args: [BigInt(raffleId)]
        });
        
        if (existingRaffle && existingRaffle[0] !== '0x0000000000000000000000000000000000000000') {
          throw new Error(`Raffle ID ${raffleId} already exists on the blockchain`);
        }
        
      } catch (preflightError) {
        console.error('Pre-flight check failed:', preflightError);
        if (preflightError instanceof Error) {
          throw preflightError;
        }
      }

      const txHash = await writeContract({
        address: this.contractAddress as `0x${string}`,
        abi: raffleContractAbi,
        functionName: 'createAndActivateTokenRaffle',
        args: [
          BigInt(raffleId),
          prizeTokenAddress as `0x${string}`,
          amountBigInt,
          BigInt(pointsPerTicket),
        ],
        // Add explicit gas limit to prevent estimation issues
        gas: BigInt(500000),
      });

      
      // Wait for transaction receipt to verify success
      const receiptResult = await this.waitForTransactionReceipt(txHash);
      if (!receiptResult.success) {
        return { 
          success: false, 
          error: `Raffle creation transaction failed: ${receiptResult.error}` 
        };
      }
      
      return { success: true, txHash };
    } catch (error: any) {
      console.error('Error in admin ERC20 raffle creation:', error);

      // Handle specific error cases with user-friendly messages
      let errorMessage = 'Unknown blockchain error';

      if (error?.message) {
        // Check for trading disabled error
        if (error.message.includes('Trading not enabled') ||
            error.message.includes('_update::Trading')) {
          errorMessage = 'Token transfers are currently disabled by the token contract. This token cannot be used for raffles until trading is enabled by the token owner.';
        }
        // Check for insufficient allowance (should be prevented by our approval logic)
        else if (error.message.includes('ERC20InsufficientAllowance') ||
                 error.message.includes('transfer amount exceeds allowance')) {
          errorMessage = 'Insufficient token allowance. Please try the approval process again.';
        }
        // Check for insufficient balance
        else if (error.message.includes('ERC20InsufficientBalance') ||
                 error.message.includes('transfer amount exceeds balance')) {
          errorMessage = 'Insufficient token balance. You do not have enough tokens to create this raffle.';
        }
        // Check for raffle already exists
        else if (error.message.includes('Raffle already exists')) {
          errorMessage = 'This raffle ID already exists on the blockchain. Please refresh and try again.';
        }
        // Check for admin permission issues
        else if (error.message.includes('Admin only') ||
                 error.message.includes('AccessControlUnauthorizedAccount')) {
          errorMessage = 'Admin permission required. Please ensure your wallet has admin privileges.';
        }
        // Generic transaction failed
        else if (error.message.includes('execution reverted')) {
          errorMessage = `Transaction failed on blockchain: ${error.message}`;
        }
        else {
          errorMessage = error.message;
        }
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * ADMIN WALLET: Activate raffle on blockchain (client-side)
   * Admin wallet directly activates the raffle
   */
  static async adminActivateRaffle(
    raffleId: number,
    writeContract: any // wagmi writeContract function
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      if (!this.contractAddress) {
        return { success: false, error: 'Raffle contract address not configured' };
      }


      const txHash = await writeContract({
        address: this.contractAddress as `0x${string}`,
        abi: raffleContractAbi,
        functionName: 'activateRaffle',
        args: [BigInt(raffleId)],
      });

      return { success: true, txHash };
    } catch (error) {
      console.error('Error in admin raffle activation:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown blockchain error' 
      };
    }
  }

  /**
   * ADMIN WALLET: Approve NFT for raffle contract (client-side)
   */
  static async adminApproveNFT(
    tokenAddress: string,
    tokenId: string,
    writeContract: any // wagmi writeContract function
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      if (!this.contractAddress) {
        return { success: false, error: 'Raffle contract address not configured' };
      }


      const txHash = await writeContract({
        address: tokenAddress as `0x${string}`,
        abi: erc721Abi,
        functionName: 'approve',
        args: [this.contractAddress as `0x${string}`, BigInt(tokenId)],
      });

      return { success: true, txHash };
    } catch (error) {
      console.error('Error in admin NFT approval:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown blockchain error' 
      };
    }
  }

  /**
   * ADMIN WALLET: Approve ERC20 for raffle contract (client-side)
   */
  static async adminApproveERC20(
    tokenAddress: string,
    amount: string,
    writeContract: any // wagmi writeContract function
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      if (!this.contractAddress) {
        return { success: false, error: 'Raffle contract address not configured' };
      }

      // Ensure proper BigInt conversion for large numbers
      let amountBigInt: bigint;
      try {
        amountBigInt = BigInt(amount);
      } catch (error) {
        console.error('Error converting amount to BigInt for approval:', amount, error);
        throw new Error(`Invalid amount format for approval: ${amount}`);
      }

      // Step 1: Reset allowance to 0 (required by many ERC20 contracts for security)
      try {
        const resetTxHash = await writeContract({
          address: tokenAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: 'approve',
          args: [this.contractAddress as `0x${string}`, BigInt(0)],
          gas: BigInt(100000),
        });

        // Wait for reset transaction to complete
        const resetReceiptResult = await this.waitForTransactionReceipt(resetTxHash);
        if (!resetReceiptResult.success) {
          return {
            success: false,
            error: `Failed to reset token allowance: ${resetReceiptResult.error}`
          };
        }
      } catch (resetError: any) {
        // If reset fails but it's due to "trading not enabled", provide clear error
        if (resetError?.message?.includes('Trading not enabled') ||
            resetError?.message?.includes('_update::Trading')) {
          return {
            success: false,
            error: 'Token transfers are currently disabled by the token contract. This token cannot be used for raffles until trading is enabled by the token owner.'
          };
        }
        console.error('Failed to reset allowance:', resetError);
        return {
          success: false,
          error: `Failed to reset allowance: ${resetError?.message || 'Unknown error'}`
        };
      }

      // Step 2: Approve the correct amount
      const txHash = await writeContract({
        address: tokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: 'approve',
        args: [this.contractAddress as `0x${string}`, amountBigInt],
        gas: BigInt(100000),
      });

      
      // Wait for transaction receipt to verify success
      const receiptResult = await this.waitForTransactionReceipt(txHash);
      if (!receiptResult.success) {
        return { 
          success: false, 
          error: `Approval transaction failed: ${receiptResult.error}` 
        };
      }
      
      return { success: true, txHash };
    } catch (error: any) {
      console.error('Error in admin ERC20 approval:', error);

      // Handle specific error cases with user-friendly messages
      let errorMessage = 'Unknown blockchain error';

      if (error?.message) {
        // Check for trading disabled error
        if (error.message.includes('Trading not enabled') ||
            error.message.includes('_update::Trading')) {
          errorMessage = 'Token transfers are currently disabled by the token contract. This token cannot be used for raffles until trading is enabled by the token owner.';
        }
        // Check for insufficient balance
        else if (error.message.includes('ERC20InsufficientBalance') ||
                 error.message.includes('transfer amount exceeds balance')) {
          errorMessage = 'Insufficient token balance. You do not have enough tokens to approve for this raffle.';
        }
        else {
          errorMessage = error.message;
        }
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * ADMIN WALLET: Refund NFT prize (for completed raffles with no winner) - client-side.
   * @param contractAddress Optional contract address override — pass raffle.contract_address
   *                        so refunds for raffles on the previous deployment route correctly.
   */
  static async adminRefundNFT(
    raffleId: number,
    recipient: string,
    writeContract: any, // wagmi writeContract function
    contractAddress?: string
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      const targetAddress = contractAddress || this.contractAddress;
      if (!targetAddress) {
        return { success: false, error: 'Raffle contract address not configured' };
      }


      const txHash = await writeContract({
        address: targetAddress as `0x${string}`,
        abi: raffleContractAbi,
        functionName: 'refundNFT',
        args: [BigInt(raffleId), recipient as `0x${string}`],
      });

      return { success: true, txHash };
    } catch (error) {
      console.error('Error in admin NFT refund:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown blockchain error' 
      };
    }
  }

  /**
   * ADMIN WALLET: Refund ERC20 tokens (for completed raffles with no winner) - client-side.
   * Only the old contract has refundToken — the new contract is NFT-only. Always pass
   * the raffle's stored contract_address to ensure this routes to the old contract.
   */
  static async adminRefundToken(
    raffleId: number,
    recipient: string,
    writeContract: any, // wagmi writeContract function
    contractAddress?: string
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      const targetAddress = contractAddress || this.contractAddress;
      if (!targetAddress) {
        return { success: false, error: 'Raffle contract address not configured' };
      }


      const txHash = await writeContract({
        address: targetAddress as `0x${string}`,
        abi: raffleContractAbi,
        functionName: 'refundToken',
        args: [BigInt(raffleId), recipient as `0x${string}`],
      });

      return { success: true, txHash };
    } catch (error) {
      console.error('Error in admin token refund:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown blockchain error' 
      };
    }
  }

  /**
   * ADMIN WALLET: End raffle (picks winner and distributes prize) - client-side
   * This method fetches participants from the database and calls the smart contract endRaffle method
   * via admin wallet instead of server wallet
   */
  static async adminEndRaffle(
    databaseId: string | number,
    writeContract: any, // wagmi writeContract function
    contractAddress?: string
  ): Promise<{ success: boolean; txHash?: string; error?: string; participants?: any[] }> {
    try {
      const raffleId = this.generateRaffleId(databaseId);

      // Fetch participants via API (client-side cannot access supabaseAdmin directly).
      // The API response also includes the raffle's contract_address so we route to
      // the correct contract for raffles escrowed on the previous deployment.
      const response = await fetch('/api/admin/raffles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'prepare_admin_end',
          raffleId: databaseId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        return { success: false, error: errorData.error || 'Failed to fetch participants via API' };
      }

      const participantsData = await response.json();

      if (!participantsData.success) {
        return { success: false, error: participantsData.error || 'API returned unsuccessful result' };
      }

      const targetAddress = contractAddress || participantsData.contractAddress || this.contractAddress;
      if (!targetAddress) {
        return { success: false, error: 'Raffle contract address not configured' };
      }

      // Use data from API response
      const participants = (participantsData.participants || []) as `0x${string}`[];
      const ticketCounts = (participantsData.ticketCounts || []).map((count: number) => BigInt(count));

      // Generate a random seed for winner selection
      const randomSeed = BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));


      // Validate that we have the correct data
      if (participantsData.totalParticipants > 0 && participants.length === 0) {
        console.error('❌ CRITICAL: API says there are participants but participants array is empty!', {
          apiResponse: participantsData,
          processedParticipants: participants,
          processedTicketCounts: ticketCounts
        });
      }

      // endRaffle signature identical on both contracts — raffle_abi works for either
      const txHash = await writeContract({
        address: targetAddress as `0x${string}`,
        abi: raffle_abi,
        functionName: 'endRaffle',
        args: [BigInt(raffleId), participants, ticketCounts, randomSeed],
      });

      
      // Wait for transaction confirmation to check if it succeeded
      try {
        const receipt = await publicClient.waitForTransactionReceipt({ 
          hash: txHash,
          timeout: 60000 // 60 seconds timeout
        });
        
        if (receipt.status === 'reverted') {
          console.error('Transaction reverted:', receipt);
          return {
            success: false,
            error: 'Transaction was reverted by the blockchain. Please check the transaction details.'
          };
        }
        
        
        return { 
          success: true, 
          txHash,
          participants: participants.map((address, index) => ({
            address,
            ticketCount: Number(ticketCounts[index])
          }))
        };
      } catch (receiptError) {
        console.error('Error waiting for transaction receipt:', receiptError);
        return {
          success: false,
          error: `Transaction may have failed. Hash: ${txHash}. Error: ${receiptError instanceof Error ? receiptError.message : 'Unknown error'}`
        };
      }
    } catch (error) {
      console.error('Error in admin end raffle:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown blockchain error'
      };
    }
  }

  // ============ NEW CONTRACT (HELD-NFT) METHODS ============

  /**
   * Read the current owner of an NFT and check whether it is the new raffle contract.
   * Used as a preflight before calling createRaffle on the new contract — the contract
   * itself reverts with "NFT not held by contract" otherwise, but checking client-side
   * lets the UI show a clear "Please transfer the NFT first" message.
   */
  static async checkNFTHeldByContract(
    tokenAddress: string,
    tokenId: string
  ): Promise<{ held: boolean; currentOwner?: string; error?: string }> {
    try {
      if (!this.contractAddress) {
        return { held: false, error: 'Raffle contract address not configured' };
      }
      const owner = await publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: erc721Abi,
        functionName: 'ownerOf',
        args: [BigInt(tokenId)],
      });
      const currentOwner = (owner as string).toLowerCase();
      const held = currentOwner === this.contractAddress.toLowerCase();
      return { held, currentOwner };
    } catch (error) {
      console.error('Error checking NFT ownership:', error);
      return {
        held: false,
        error: error instanceof Error ? error.message : 'Failed to read NFT owner'
      };
    }
  }

  static async waitForNFTHeldByContract(
    tokenAddress: string,
    tokenId: string,
    timeoutMs = 60000,
    intervalMs = 2500
  ): Promise<{ held: boolean; currentOwner?: string; error?: string }> {
    const deadline = Date.now() + timeoutMs;
    let lastCheck: { held: boolean; currentOwner?: string; error?: string } = {
      held: false,
      error: 'NFT ownership confirmation timed out'
    };

    while (Date.now() <= deadline) {
      lastCheck = await this.checkNFTHeldByContract(tokenAddress, tokenId);
      if (lastCheck.held) {
        return lastCheck;
      }
      await this.sleep(intervalMs);
    }

    return {
      ...lastCheck,
      held: false,
      error: `NFT #${tokenId} is not held by the raffle contract yet (current owner: ${lastCheck.currentOwner || 'unknown'}). Wait a moment and try again.`
    };
  }

  /**
   * ADMIN WALLET: Transfer an NFT from the admin wallet into the new raffle contract
   * so it can be used as a prize via createRaffle (held-NFT flow).
   *
   * The admin can alternatively send the NFT directly from any wallet (e.g. cold
   * wallet, OpenSea, etherscan) — this helper just exposes the same operation in
   * the admin UI for convenience.
   */
  static async adminTransferNFTToRaffle(
    tokenAddress: string,
    tokenId: string,
    fromAddress: string,
    writeContract: any // wagmi writeContract function
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      if (!this.contractAddress) {
        return { success: false, error: 'Raffle contract address not configured' };
      }

      const txHash = await writeContract({
        address: tokenAddress as `0x${string}`,
        abi: erc721Abi,
        functionName: 'safeTransferFrom',
        args: [
          fromAddress as `0x${string}`,
          this.contractAddress as `0x${string}`,
          BigInt(tokenId),
        ],
      });

      const receiptResult = await this.waitForTransactionReceipt(txHash);
      if (!receiptResult.success) {
        return {
          success: false,
          error: `NFT transfer to raffle contract failed: ${receiptResult.error}`
        };
      }

      const ownership = await this.waitForNFTHeldByContract(tokenAddress, tokenId);
      if (!ownership.held) {
        return {
          success: false,
          error: ownership.error || `NFT #${tokenId} transfer confirmed, but ownership has not updated yet. Try deployment again in a moment.`
        };
      }

      return { success: true, txHash };
    } catch (error) {
      console.error('Error transferring NFT to raffle contract:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown blockchain error'
      };
    }
  }

  /**
   * ADMIN WALLET: Rescue an NFT that was transferred into the raffle contract
   * but was never assigned to an on-chain raffle.
   */
  static async adminRescueUnassignedNFT(
    prizeTokenAddress: string,
    tokenId: string,
    recipient: string,
    writeContract: any // wagmi writeContract function
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      if (!this.contractAddress) {
        return { success: false, error: 'Raffle contract address not configured' };
      }

      const txHash = await writeContract({
        address: this.contractAddress as `0x${string}`,
        abi: new_raffle_abi,
        functionName: 'rescueUnassignedNFT',
        args: [
          prizeTokenAddress as `0x${string}`,
          BigInt(tokenId),
          recipient as `0x${string}`,
        ],
        gas: BigInt(250000),
      });

      const receiptResult = await this.waitForTransactionReceipt(txHash);
      if (!receiptResult.success) {
        return {
          success: false,
          error: `NFT rescue transaction failed: ${receiptResult.error}`
        };
      }

      return { success: true, txHash };
    } catch (error: any) {
      console.error('Error rescuing unassigned NFT:', error);
      let errorMessage = 'Unknown blockchain error';
      if (error?.message) {
        if (error.message.includes('NFT assigned to raffle')) {
          errorMessage = 'This NFT is assigned to a raffle. Use emergency withdraw or refund for that raffle instead.';
        } else if (error.message.includes('NFT not held by contract')) {
          errorMessage = 'The raffle contract does not currently hold this NFT.';
        } else if (error.message.includes('Admin only') || error.message.includes('AccessControlUnauthorizedAccount')) {
          errorMessage = 'Admin permission required. Ensure your wallet has admin role on the raffle contract.';
        } else {
          errorMessage = error.message;
        }
      }
      return { success: false, error: errorMessage };
    }
  }

  /**
   * ADMIN WALLET: Create + activate a raffle on the new contract using an NFT
   * that has already been deposited into the contract.
   *
   * Preconditions:
   *   - NEW raffle contract is deployed and NEXT_PUBLIC_RAFFLE_CONTRACT_ADDRESS points to it.
   *   - The NFT (tokenAddress, tokenId) is currently owned by the contract.
   *   - msg.sender has ADMIN_ROLE on the contract.
   */
  static async adminCreateRaffleWithHeldNFT(
    raffleId: number,
    prizeTokenAddress: string,
    tokenId: string,
    pointsPerTicket: number,
    writeContract: any // wagmi writeContract function
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      if (!this.contractAddress) {
        return { success: false, error: 'Raffle contract address not configured' };
      }

      // Preflight: confirm contract still owns the NFT before paying gas
      const ownership = await this.waitForNFTHeldByContract(prizeTokenAddress, tokenId, 20000, 2000);
      if (!ownership.held) {
        return {
          success: false,
          error: `NFT #${tokenId} is not held by the raffle contract (current owner: ${ownership.currentOwner || 'unknown'}). Transfer it first.`
        };
      }

      // Preflight: confirm the raffle id is free on-chain
      try {
        const existing = await this.publicClient.readContract({
          address: this.contractAddress as `0x${string}`,
          abi: new_raffle_abi,
          functionName: 'getRaffleInfo',
          args: [BigInt(raffleId)],
        });
        if (existing && (existing as any)[0] !== '0x0000000000000000000000000000000000000000') {
          return { success: false, error: `Raffle ID ${raffleId} already exists on the blockchain` };
        }
      } catch (preflightError) {
        // getRaffleInfo on a non-existent raffle returns zero struct, not revert — surface other errors only
        console.error('Pre-flight read failed:', preflightError);
      }

      const txHash = await writeContract({
        address: this.contractAddress as `0x${string}`,
        abi: new_raffle_abi,
        functionName: 'createRaffle',
        args: [
          BigInt(raffleId),
          prizeTokenAddress as `0x${string}`,
          BigInt(tokenId),
          BigInt(pointsPerTicket),
        ],
        gas: BigInt(500000),
      });

      const receiptResult = await this.waitForTransactionReceipt(txHash);
      if (!receiptResult.success) {
        return {
          success: false,
          error: `Raffle creation transaction failed: ${receiptResult.error}`
        };
      }

      return { success: true, txHash };
    } catch (error: any) {
      console.error('Error in held-NFT raffle creation:', error);
      let errorMessage = 'Unknown blockchain error';
      if (error?.message) {
        if (error.message.includes('NFT not held by contract')) {
          errorMessage = 'NFT is not currently held by the raffle contract. Transfer it in first.';
        } else if (error.message.includes('Raffle already exists')) {
          errorMessage = 'This raffle ID already exists on the blockchain. Refresh and try again.';
        } else if (error.message.includes('Admin only') || error.message.includes('AccessControlUnauthorizedAccount')) {
          errorMessage = 'Admin permission required. Ensure your wallet has admin role on the new raffle contract.';
        } else {
          errorMessage = error.message;
        }
      }
      return { success: false, error: errorMessage };
    }
  }
}

// Export contract address for use in other components
export const RAFFLE_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_RAFFLE_CONTRACT_ADDRESS || '';
