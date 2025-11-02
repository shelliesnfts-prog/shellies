interface PriceCache {
  price: number;
  timestamp: number;
}

export class PriceOracle {
  private static cache: PriceCache | null = null;
  private static CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private static FALLBACK_PRICE = 2500; // Default ETH price in USD

  /**
   * Fetches the current ETH/USD price from CoinGecko API
   * Uses 5-minute caching to reduce API calls
   * Falls back to default price if API fails
   */
  static async getEthPrice(): Promise<number> {
    // Check cache
    if (this.cache && Date.now() - this.cache.timestamp < this.CACHE_DURATION) {
      return this.cache.price;
    }

    try {
      // Fetch from CoinGecko
      const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      const price = data.ethereum.usd;

      if (typeof price !== 'number' || price <= 0) {
        throw new Error('Invalid price data received');
      }

      // Update cache
      this.cache = { price, timestamp: Date.now() };
      return price;
    } catch (error) {
      console.error('Failed to fetch ETH price:', error);
      return this.FALLBACK_PRICE;
    }
  }

  /**
   * Calculates the required ETH amount for a given USD amount
   * @param usdAmount - The USD amount to convert
   * @param ethPrice - The current ETH/USD price
   * @returns The required ETH amount
   */
  static calculateRequiredEth(usdAmount: number, ethPrice: number): number {
    if (ethPrice <= 0) {
      throw new Error('ETH price must be greater than 0');
    }
    return usdAmount / ethPrice;
  }

  /**
   * Clears the price cache (useful for testing)
   */
  static clearCache(): void {
    this.cache = null;
  }
}
