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
  
  // Create public client for reading transaction receipts
  private static publicClient = createPublicClient({
    chain: inkChain,
    transport: http()
  });

  /**
   * Wait for transaction receipt and verify success
   * @param txHash - Transaction hash to wait for
   * @returns Promise that resolves when transaction is confirmed
   */
  private static async waitForTransactionReceipt(txHash: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('Waiting for transaction receipt:', txHash);
      
      const receipt = await this.publicClient.waitForTransactionReceipt({ 
        hash: txHash as `0x${string}`,
        timeout: 60000 // 60 second timeout
      });
      
      console.log('Transaction receipt:', receipt);
      
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
            console.log('Failed transaction details:', transaction);
            
            try {
              // Try to simulate the transaction to get the revert reason
              await this.publicClient.call({
                account: transaction.from,
                to: transaction.to,
                data: transaction.input,
                value: transaction.value
              });
            } catch (simulationError: any) {
              console.log('Transaction simulation error:', simulationError);
              
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
          console.log('Could not get transaction details:', detailError);
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
    state: number;
    winner: string;
  } | null> {
    try {
      if (!this.contractAddress) {
        console.error('Raffle contract address not configured');
        return null;
      }

      const result = await publicClient.readContract({
        address: this.contractAddress as `0x${string}`,
        abi: raffleContractAbi,
        functionName: 'getRaffleInfo',
        args: [BigInt(raffleId)],
      });

      const [prizeToken, prizeTokenId, state, isNFT, winner] = result as [
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
    console.warn('🚨 Attempted to use deprecated serverCreateRaffleWithNFT method');
    
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
    console.warn('🚨 Attempted to use deprecated serverCreateRaffleWithToken method');
    
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
    console.warn('🚨 Attempted to use deprecated serverActivateRaffle method');
    
    return {
      success: false,
      error: 'Server wallet raffle activation has been deprecated. Please use adminActivateRaffle for better security and control.'
    };
  }

  // Phase 3: Removed duplicate serverCreateAndActivateRaffle method

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
        args: [BigInt(raffleId), participants, ticketCounts, randomSeed],
      });

      console.log('End raffle transaction submitted:', txHash);
      
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
    writeContract: any // wagmi writeContract function
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    console.log("====> create raffle with NFT");
    try {
      if (!this.contractAddress) {
        return { success: false, error: 'Raffle contract address not configured' };
      }

      console.log('Admin creating NFT raffle with parameters:', {
        raffleId,
        prizeTokenAddress,
        tokenId,
        contractAddress: this.contractAddress
      });


      // Call the contract method directly (admin wallet will be prompted to sign)
      // Use createAndActivateNFTRaffle since it combines create + activate in one transaction
      console.log('🚀 Proceeding with actual transaction...');
      const txHash = await writeContract({
        address: this.contractAddress as `0x${string}`,
        abi: raffleContractAbi,
        functionName: 'createAndActivateNFTRaffle',
        args: [
          BigInt(raffleId),
          prizeTokenAddress as `0x${string}`,
          BigInt(tokenId)
        ],
      });

      console.log('Admin NFT raffle creation transaction:', txHash);
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
    writeContract: any // wagmi writeContract function
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      if (!this.contractAddress) {
        return { success: false, error: 'Raffle contract address not configured' };
      }

      console.log('Admin creating ERC20 raffle with parameters:', {
        raffleId,
        prizeTokenAddress,
        amount
      });

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
      
      console.log('Calling createAndActivateTokenRaffle with:', {
        raffleId: BigInt(raffleId).toString(),
        prizeTokenAddress,
        amount: amountBigInt.toString(),
        amountLength: amountBigInt.toString().length
      });

      // Pre-flight checks before calling the contract
      try {
        console.log('Performing pre-flight checks...');
        
        // Check if raffle already exists
        const existingRaffle = await this.publicClient.readContract({
          address: this.contractAddress as `0x${string}`,
          abi: raffleContractAbi,
          functionName: 'getRaffleInfo',
          args: [BigInt(raffleId)]
        });
        
        console.log('Existing raffle check:', existingRaffle);
        if (existingRaffle && existingRaffle[0] !== '0x0000000000000000000000000000000000000000') {
          throw new Error(`Raffle ID ${raffleId} already exists on the blockchain`);
        }
        
        console.log('Pre-flight checks passed ✅');
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
          amountBigInt
        ],
        // Add explicit gas limit to prevent estimation issues
        gas: BigInt(500000),
      });

      console.log('Admin ERC20 raffle creation transaction submitted:', txHash);
      
      // Wait for transaction receipt to verify success
      const receiptResult = await this.waitForTransactionReceipt(txHash);
      if (!receiptResult.success) {
        return { 
          success: false, 
          error: `Raffle creation transaction failed: ${receiptResult.error}` 
        };
      }
      
      console.log('Admin ERC20 raffle creation transaction confirmed successfully');
      return { success: true, txHash };
    } catch (error) {
      console.error('Error in admin ERC20 raffle creation:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown blockchain error' 
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

      console.log('Admin activating raffle:', raffleId);

      const txHash = await writeContract({
        address: this.contractAddress as `0x${string}`,
        abi: raffleContractAbi,
        functionName: 'activateRaffle',
        args: [BigInt(raffleId)],
      });

      console.log('Admin raffle activation transaction:', txHash);
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

      console.log('Admin approving NFT:', { tokenAddress, tokenId });

      const txHash = await writeContract({
        address: tokenAddress as `0x${string}`,
        abi: erc721Abi,
        functionName: 'approve',
        args: [this.contractAddress as `0x${string}`, BigInt(tokenId)],
      });

      console.log('Admin NFT approval transaction:', txHash);
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

      console.log('Admin approving ERC20:', { tokenAddress, amount });

      // Ensure proper BigInt conversion for large numbers
      let amountBigInt: bigint;
      try {
        amountBigInt = BigInt(amount);
      } catch (error) {
        console.error('Error converting amount to BigInt for approval:', amount, error);
        throw new Error(`Invalid amount format for approval: ${amount}`);
      }

      console.log('Calling ERC20 approve with:', {
        tokenAddress,
        spender: this.contractAddress,
        amount: amountBigInt.toString(),
        amountLength: amountBigInt.toString().length
      });

      const txHash = await writeContract({
        address: tokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: 'approve',
        args: [this.contractAddress as `0x${string}`, amountBigInt],
        // Add explicit gas limit to prevent estimation issues
        gas: BigInt(100000),
      });

      console.log('Admin ERC20 approval transaction submitted:', txHash);
      
      // Wait for transaction receipt to verify success
      const receiptResult = await this.waitForTransactionReceipt(txHash);
      if (!receiptResult.success) {
        return { 
          success: false, 
          error: `Approval transaction failed: ${receiptResult.error}` 
        };
      }
      
      console.log('Admin ERC20 approval transaction confirmed successfully');
      return { success: true, txHash };
    } catch (error) {
      console.error('Error in admin ERC20 approval:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown blockchain error' 
      };
    }
  }

  /**
   * ADMIN WALLET: Refund NFT prize (for completed raffles with no winner) - client-side
   */
  static async adminRefundNFT(
    raffleId: number,
    recipient: string,
    writeContract: any // wagmi writeContract function
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      if (!this.contractAddress) {
        return { success: false, error: 'Raffle contract address not configured' };
      }

      console.log('Admin refunding NFT:', { raffleId, recipient });

      const txHash = await writeContract({
        address: this.contractAddress as `0x${string}`,
        abi: raffleContractAbi,
        functionName: 'refundNFT',
        args: [BigInt(raffleId), recipient as `0x${string}`],
      });

      console.log('Admin NFT refund transaction:', txHash);
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
   * ADMIN WALLET: Refund ERC20 tokens (for completed raffles with no winner) - client-side
   */
  static async adminRefundToken(
    raffleId: number,
    recipient: string,
    writeContract: any // wagmi writeContract function
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      if (!this.contractAddress) {
        return { success: false, error: 'Raffle contract address not configured' };
      }

      console.log('Admin refunding tokens:', { raffleId, recipient });

      const txHash = await writeContract({
        address: this.contractAddress as `0x${string}`,
        abi: raffleContractAbi,
        functionName: 'refundToken',
        args: [BigInt(raffleId), recipient as `0x${string}`],
      });

      console.log('Admin token refund transaction:', txHash);
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
    writeContract: any // wagmi writeContract function
  ): Promise<{ success: boolean; txHash?: string; error?: string; participants?: any[] }> {
    try {
      if (!this.contractAddress) {
        return { success: false, error: 'Raffle contract address not configured' };
      }

      const raffleId = this.generateRaffleId(databaseId);
      
      // Fetch participants via API (client-side cannot access supabaseAdmin directly)
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

      console.log('🔍 DEBUG: API response for participants:', participantsData);

      // Use data from API response
      const participants = (participantsData.participants || []) as `0x${string}`[];
      const ticketCounts = (participantsData.ticketCounts || []).map((count: number) => BigInt(count));
      
      // Generate a random seed for winner selection
      const randomSeed = BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));
      
      console.log('🔍 DEBUG: Admin ending raffle with detailed parameters:', {
        raffleId,
        databaseId,
        participantsCount: participants.length,
        participants: participants,
        ticketCounts: ticketCounts.map((count:any) => count.toString()),
        totalTickets: ticketCounts.reduce((sum: any, count: any) => sum + count, BigInt(0)).toString(),
        randomSeed: randomSeed.toString(),
        contractAddress: this.contractAddress,
        apiResponseData: participantsData
      });

      // Validate that we have the correct data
      if (participantsData.totalParticipants > 0 && participants.length === 0) {
        console.error('❌ CRITICAL: API says there are participants but participants array is empty!', {
          apiResponse: participantsData,
          processedParticipants: participants,
          processedTicketCounts: ticketCounts
        });
      }

      // Call endRaffle on the smart contract with all required parameters
      // Contract will handle the case where participants array is empty
      const txHash = await writeContract({
        address: this.contractAddress as `0x${string}`,
        abi: raffle_abi,
        functionName: 'endRaffle',
        args: [BigInt(raffleId), participants, ticketCounts, randomSeed],
      });

      console.log('Admin end raffle transaction submitted:', txHash);
      
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
        
        console.log('Admin end raffle transaction confirmed:', receipt);
        
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
}

// Export contract address for use in other components
export const RAFFLE_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_RAFFLE_CONTRACT_ADDRESS || '';