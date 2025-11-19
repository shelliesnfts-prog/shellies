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
  
  const block = await client.getBlock({ 
    blockNumber: receipt.blockNumber 
  });
  
  return Number(block.timestamp);
}
