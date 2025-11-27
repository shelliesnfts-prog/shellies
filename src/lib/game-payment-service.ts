import { writeContract, waitForTransactionReceipt } from '@wagmi/core';
import { parseEther } from 'viem';
import { game_payment_abi } from '@/lib/game-payment-abi';
import { getConfig } from '@/lib/wagmi';

/**
 * Pay for XP to Points conversion
 * 
 * @param amountInUSD - Amount to pay in USD (typically 0.1)
 * @param ethPriceInUSD - Current ETH price in USD
 * @returns Transaction hash
 */
export async function payForXPConversion(
  amountInUSD: number,
  ethPriceInUSD: number
): Promise<string> {
  const contractAddress = process.env.NEXT_PUBLIC_GAME_PAYMENT_CONTRACT_ADDRESS || 
                          process.env.NEXT_PUBLIC_GAME_PAYMENT_CONTRACT;
  
  if (!contractAddress) {
    throw new Error('Game payment contract address not configured');
  }
  
  if (ethPriceInUSD <= 0) {
    throw new Error('Invalid ETH price');
  }
  
  // Calculate ETH amount based on current price
  const ethAmount = amountInUSD / ethPriceInUSD;
  
  // Call contract
  const hash = await writeContract(getConfig(), {
    address: contractAddress as `0x${string}`,
    abi: game_payment_abi,
    functionName: 'payToConvertXP',
    value: parseEther(ethAmount.toString())
  });
  
  // Wait for confirmation
  await waitForTransactionReceipt(getConfig(), { hash });
  
  return hash;
}

/**
 * Get transaction details from blockchain
 * Used to extract timestamp for recovery mechanism
 * 
 * @param txHash - Transaction hash
 * @returns Transaction timestamp in seconds
 */
export async function getTransactionTimestamp(txHash: string): Promise<number> {
  const { createPublicClient, http } = await import('viem');
  const { inkChain } = await import('@/lib/wagmi');
  
  const client = createPublicClient({
    chain: inkChain,
    transport: http()
  });
  
  const receipt = await client.getTransactionReceipt({ 
    hash: txHash as `0x${string}` 
  });
  
  if (!receipt) {
    throw new Error('Transaction not found');
  }
  
  // Retry logic for fetching block (handles "block out of range" errors)
  const maxRetries = 5;
  const baseDelay = 1000; // 1 second
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const block = await client.getBlock({ 
        blockNumber: receipt.blockNumber 
      });
      
      return Number(block.timestamp);
    } catch (error: any) {
      const isLastAttempt = attempt === maxRetries - 1;
      const isBlockOutOfRange = error?.message?.includes('block is out of range') || 
                                 error?.details?.includes('block is out of range');
      
      if (isBlockOutOfRange && !isLastAttempt) {
        // Wait with exponential backoff before retrying
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`Block not indexed yet, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // If it's the last attempt or a different error, throw
      throw new Error(`Failed to fetch block timestamp: ${error?.message || 'Unknown error'}`);
    }
  }
  
  throw new Error('Failed to fetch block timestamp after multiple retries');
}
