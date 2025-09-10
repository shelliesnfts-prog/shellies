import { formatUnits, parseUnits } from 'viem';

/**
 * Converts a token amount from wei to human-readable format
 * @param weiAmount - The amount in wei (as string or bigint)
 * @param decimals - Number of decimals for the token (default: 18)
 * @returns Human-readable token amount as string
 */
export function formatTokenAmount(weiAmount: string | bigint, decimals: number = 18): string {
  try {
    return formatUnits(BigInt(weiAmount), decimals);
  } catch (error) {
    console.error('Error formatting token amount:', error);
    return '0';
  }
}

/**
 * Converts a human-readable token amount to wei
 * @param tokenAmount - The human-readable amount as string (e.g., "143")
 * @param decimals - Number of decimals for the token (default: 18)
 * @returns Wei amount as string
 */
export function parseTokenAmount(tokenAmount: string, decimals: number = 18): string {
  try {
    if (!tokenAmount || tokenAmount.trim() === '') {
      return '0';
    }
    
    // Use parseFloat instead of Number for better precision handling
    // and validate that it's a valid positive number
    const numValue = parseFloat(tokenAmount);
    if (isNaN(numValue) || numValue < 0 || !isFinite(numValue)) {
      return '0';
    }
    
    return parseUnits(tokenAmount, decimals).toString();
  } catch (error) {
    console.error('Error parsing token amount:', error);
    return '0';
  }
}

/**
 * Validates if a token amount string is valid
 * @param tokenAmount - The token amount as string
 * @returns true if valid, false otherwise
 */
export function isValidTokenAmount(tokenAmount: string): boolean {
  if (!tokenAmount || tokenAmount.trim() === '') {
    return false;
  }
  
  const num = parseFloat(tokenAmount);
  return !isNaN(num) && num >= 0 && isFinite(num);
}

/**
 * Formats a token amount for display with appropriate decimal places
 * @param weiAmount - The amount in wei (as string or bigint)
 * @param decimals - Number of decimals for the token (default: 18)
 * @param displayDecimals - Number of decimal places to show (default: 4)
 * @returns Formatted token amount for display
 */
export function formatTokenDisplay(
  weiAmount: string | bigint, 
  decimals: number = 18, 
  displayDecimals: number = 4
): string {
  try {
    const formatted = formatUnits(BigInt(weiAmount), decimals);
    const num = parseFloat(formatted);
    
    // If it's a whole number, don't show decimals
    if (num % 1 === 0) {
      return num.toLocaleString();
    }
    
    // Otherwise, format with specified decimal places
    return parseFloat(formatted).toFixed(displayDecimals).replace(/\.?0+$/, '');
  } catch (error) {
    console.error('Error formatting token display:', error);
    return '0';
  }
}