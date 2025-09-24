/**
 * Image utilities for better NFT image loading in production
 */

export class ImageUtils {
  // Reliable IPFS gateways ordered by performance
  private static readonly IPFS_GATEWAYS = [
    'https://cloudflare-ipfs.com/ipfs/',
    'https://gateway.pinata.cloud/ipfs/',
    'https://ipfs.io/ipfs/',
    'https://gateway.ipfs.io/ipfs/',
    'https://dweb.link/ipfs/',
    'https://4everland.io/ipfs/',
    'https://cf-ipfs.com/ipfs/'
  ];

  /**
   * Convert IPFS URL to HTTP URL using the most reliable gateway
   */
  static convertIpfsToHttp(url: string): string {
    if (!url || !url.startsWith('ipfs://')) {
      return url;
    }

    const hash = url.replace('ipfs://', '');
    
    // Use Cloudflare IPFS gateway which has excellent uptime and CDN
    return `${this.IPFS_GATEWAYS[0]}${hash}`;
  }

  /**
   * Get all possible IPFS gateway URLs for an IPFS hash
   */
  static getAllIpfsUrls(ipfsUrl: string): string[] {
    if (!ipfsUrl || !ipfsUrl.startsWith('ipfs://')) {
      return [ipfsUrl];
    }

    const hash = ipfsUrl.replace('ipfs://', '');
    return this.IPFS_GATEWAYS.map(gateway => `${gateway}${hash}`);
  }

  /**
   * Validate if a URL is accessible (basic validation)
   */
  static isValidImageUrl(url: string): boolean {
    if (!url) return false;

    try {
      new URL(url);
      return url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i) !== null ||
             url.includes('ipfs') ||
             url.includes('image');
    } catch {
      return false;
    }
  }

  /**
   * Preload an image and return a promise
   */
  static preloadImage(src: string): Promise<boolean> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = src;
      
      // Timeout after 10 seconds
      setTimeout(() => resolve(false), 10000);
    });
  }

  /**
   * Try loading image from multiple sources until one works
   */
  static async loadImageWithFallbacks(sources: string[]): Promise<string | null> {
    for (const src of sources) {
      if (!this.isValidImageUrl(src)) continue;
      
      const success = await this.preloadImage(src);
      if (success) {
        return src;
      }
    }
    return null;
  }

  /**
   * Process NFT image URL for optimal loading
   */
  static processNftImageUrl(rawUrl: string | undefined): {
    primaryUrl?: string;
    fallbackUrls: string[];
  } {
    if (!rawUrl) {
      return { fallbackUrls: [] };
    }

    if (rawUrl.startsWith('ipfs://')) {
      const allUrls = this.getAllIpfsUrls(rawUrl);
      return {
        primaryUrl: allUrls[0],
        fallbackUrls: allUrls.slice(1)
      };
    }

    if (this.isValidImageUrl(rawUrl)) {
      return {
        primaryUrl: rawUrl,
        fallbackUrls: []
      };
    }

    return { fallbackUrls: [] };
  }

  /**
   * Add loading optimization attributes for images
   */
  static getImageAttributes(isAboveFold: boolean = false) {
    return {
      loading: isAboveFold ? 'eager' : 'lazy' as 'eager' | 'lazy',
      decoding: 'async' as 'async',
      fetchPriority: isAboveFold ? 'high' : 'auto' as 'high' | 'auto'
    };
  }
}