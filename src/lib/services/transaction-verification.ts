import { createPublicClient, http } from 'viem';
import { inkChain } from '@/lib/wagmi';

interface TransactionData {
  isValid: boolean;
  timestamp: number;
  amount: bigint;
  amountInUSD: number;
  from: string;
  to: string;
}

/**
 * Verify a conversion payment transaction on the blockchain
 * 
 * @param txHash - Transaction hash to verify
 * @param expectedWallet - Expected wallet address (from session)
 * @returns Transaction data with validation result
 */
export async function verifyConversionPayment(
  txHash: string,
  expectedWallet: string
): Promise<TransactionData> {
  try {
    const client = createPublicClient({
      chain: inkChain,
      transport: http()
    });
    
    // Fetch transaction receipt
    const receipt = await client.getTransactionReceipt({ 
      hash: txHash as `0x${string}` 
    });
    
    if (!receipt) {
      return { 
        isValid: false, 
        timestamp: 0, 
        amount: BigInt(0), 
        amountInUSD: 0, 
        from: '', 
        to: '' 
      };
    }
    
    // Fetch transaction details
    const tx = await client.getTransaction({ 
      hash: txHash as `0x${string}` 
    });
    
    // Get block timestamp with retry logic (handles "block out of range" errors)
    let blockTimestamp: bigint;
    const maxRetries = 5;
    const baseDelay = 1000; // 1 second
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const block = await client.getBlock({ 
          blockNumber: receipt.blockNumber 
        });
        blockTimestamp = block.timestamp;
        break;
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
        throw error;
      }
    }
    
    // CRITICAL SECURITY CHECKS:
    // 1. Transaction was successful
    // 2. Transaction sender matches authenticated user (prevents using other user's payments)
    // 3. Transaction recipient is the payment contract
    const contractAddress = process.env.NEXT_PUBLIC_GAME_PAYMENT_CONTRACT_ADDRESS || 
                            process.env.NEXT_PUBLIC_GAME_PAYMENT_CONTRACT;
    
    const isValid = 
      receipt.status === 'success' &&
      tx.from.toLowerCase() === expectedWallet.toLowerCase() &&
      tx.to?.toLowerCase() === contractAddress?.toLowerCase();
    
    // Get current ETH price in USD
    const ethPriceInUSD = await getETHPriceInUSD();
    const amountInETH = Number(tx.value) / 1e18;
    const amountInUSD = amountInETH * ethPriceInUSD;
    
    return {
      isValid,
      timestamp: Number(blockTimestamp!),
      amount: tx.value,
      amountInUSD,
      from: tx.from,
      to: tx.to || ''
    };
    
  } catch (error) {
    console.error('Error verifying conversion payment:', error);
    return { 
      isValid: false, 
      timestamp: 0, 
      amount: BigInt(0), 
      amountInUSD: 0, 
      from: '', 
      to: '' 
    };
  }
}

/**
 * Verify a game payment transaction on the blockchain
 * 
 * @param txHash - Transaction hash to verify
 * @param expectedWallet - Expected wallet address (from session)
 * @param expectedAmountUsd - Expected payment amount in USD (optional, for validation)
 * @returns Transaction data with validation result
 */
export async function verifyGamePayment(
  txHash: string,
  expectedWallet: string,
  expectedAmountUsd?: number
): Promise<TransactionData> {
  try {
    // Validate transaction hash format
    if (!txHash || typeof txHash !== 'string' || txHash.length !== 66 || !txHash.startsWith('0x')) {
      console.warn(`❌ Invalid transaction hash format: ${txHash}`);
      return { 
        isValid: false, 
        timestamp: 0, 
        amount: BigInt(0), 
        amountInUSD: 0, 
        from: '', 
        to: '' 
      };
    }

    console.log('🔗 Creating blockchain client for verification...');
    
    const client = createPublicClient({
      chain: inkChain,
      transport: http()
    });
    
    console.log('📥 Fetching transaction receipt...');
    
    // Fetch transaction receipt
    const receipt = await client.getTransactionReceipt({ 
      hash: txHash as `0x${string}` 
    });
    
    if (!receipt) {
      console.warn(`❌ Transaction receipt not found for: ${txHash}`);
      return { 
        isValid: false, 
        timestamp: 0, 
        amount: BigInt(0), 
        amountInUSD: 0, 
        from: '', 
        to: '' 
      };
    }
    
    console.log('✅ Receipt found:', {
      blockNumber: receipt.blockNumber.toString(),
      status: receipt.status,
      gasUsed: receipt.gasUsed.toString()
    });
    
    console.log('📥 Fetching transaction details...');
    
    // Fetch transaction details
    const tx = await client.getTransaction({ 
      hash: txHash as `0x${string}` 
    });
    
    console.log('✅ Transaction details:', {
      from: tx.from,
      to: tx.to,
      value: tx.value.toString()
    });
    
    // Get block timestamp with retry logic
    console.log('⏰ Fetching block timestamp...');
    
    let blockTimestamp: bigint = BigInt(0);
    const maxRetries = 5;
    const baseDelay = 1000;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const block = await client.getBlock({ 
          blockNumber: receipt.blockNumber 
        });
        blockTimestamp = block.timestamp;
        console.log(`✅ Block timestamp retrieved: ${blockTimestamp}`);
        break;
      } catch (error: any) {
        const isLastAttempt = attempt === maxRetries - 1;
        const isBlockOutOfRange = error?.message?.includes('block is out of range') || 
                                   error?.details?.includes('block is out of range');
        
        if (isBlockOutOfRange && !isLastAttempt) {
          const delay = baseDelay * Math.pow(2, attempt);
          console.log(`⏳ Block not indexed yet, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        console.error(`❌ Error fetching block (attempt ${attempt + 1}/${maxRetries}):`, error);
        throw error;
      }
    }
    
    // CRITICAL SECURITY CHECKS for game payment:
    // 1. Transaction was successful
    // 2. Transaction sender matches authenticated user
    // 3. Transaction recipient is the game payment contract
    const gamePaymentContract = process.env.NEXT_PUBLIC_GAME_PAYMENT_CONTRACT_ADDRESS || 
                                 process.env.NEXT_PUBLIC_GAME_PAYMENT_CONTRACT;
    
    console.log('🔐 Performing security checks...');
    console.log('Expected contract:', gamePaymentContract);
    
    // Get current ETH price and calculate USD value
    console.log('💰 Fetching ETH price...');
    
    const ethPriceInUSD = await getETHPriceInUSD();
    const amountInETH = Number(tx.value) / 1e18;
    const amountInUSD = amountInETH * ethPriceInUSD;
    
    console.log('💵 Payment amount:', {
      amountInETH,
      amountInUSD,
      ethPrice: ethPriceInUSD
    });
    
    // Validate all conditions
    const isTransactionSuccessful = receipt.status === 'success';
    const isFromCorrectWallet = tx.from.toLowerCase() === expectedWallet.toLowerCase();
    const isToCorrectContract = tx.to?.toLowerCase() === gamePaymentContract?.toLowerCase();
    
    // Optional: Validate payment amount (with 20% tolerance for ETH price fluctuations)
    // Skip validation if expectedAmountUsd is 0 or not provided (for tier-based pricing)
    let isAmountValid = true;
    if (expectedAmountUsd && expectedAmountUsd > 0) {
      const minAmount = expectedAmountUsd * 0.8;
      const maxAmount = expectedAmountUsd * 1.2;
      isAmountValid = amountInUSD >= minAmount && amountInUSD <= maxAmount;
      
      console.log('💵 Amount validation:', {
        expectedAmountUsd,
        actualAmountUsd: amountInUSD,
        minAmount,
        maxAmount,
        isValid: isAmountValid
      });
    } else {
      console.log('💵 Amount validation: SKIPPED (tier-based pricing enabled)');
    }
    
    const isValid = isTransactionSuccessful && isFromCorrectWallet && isToCorrectContract && isAmountValid;
    
    console.log('🔐 Security check results:', {
      isTransactionSuccessful,
      isFromCorrectWallet,
      isToCorrectContract,
      isAmountValid,
      overallValid: isValid
    });
    
    if (!isValid) {
      console.warn(`Game payment verification failed for ${txHash}:`, {
        isTransactionSuccessful,
        isFromCorrectWallet,
        isToCorrectContract,
        isAmountValid,
        expectedWallet,
        actualFrom: tx.from,
        expectedContract: gamePaymentContract,
        actualTo: tx.to,
        amountInUSD,
        expectedAmountUsd
      });
    }
    
    return {
      isValid,
      timestamp: Number(blockTimestamp),
      amount: tx.value,
      amountInUSD,
      from: tx.from,
      to: tx.to || ''
    };
    
  } catch (error: any) {
    console.error('❌ Error verifying game payment:', {
      error,
      message: error?.message,
      code: error?.code,
      details: error?.details,
      txHash
    });
    return { 
      isValid: false, 
      timestamp: 0, 
      amount: BigInt(0), 
      amountInUSD: 0, 
      from: '', 
      to: '' 
    };
  }
}

async function getETHPriceInUSD(): Promise<number> {
  try {
    // Try to use existing price oracle if available
    const { PriceOracle } = await import('@/lib/price-oracle');
    const ethPrice = await PriceOracle.getEthPrice();
    
    if (ethPrice && ethPrice > 0) {
      return ethPrice;
    }
    
    // Fallback to CoinGecko API
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
      { next: { revalidate: 60 } } // Cache for 1 minute
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch ETH price');
    }
    
    const data = await response.json();
    return data.ethereum?.usd || 3000; // Default fallback
    
  } catch (error) {
    console.error('Error fetching ETH price:', error);
    // Return a reasonable default if all else fails
    return 3000;
  }
}
