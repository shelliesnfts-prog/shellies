import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    const browserCachedAssetHeaders = [
      {
        key: 'Cache-Control',
        value: 'public, max-age=604800, stale-while-revalidate=86400',
      },
    ];

    return [
      {
        source: '/mario-game-v2/:path*',
        headers: browserCachedAssetHeaders,
      },
      {
        source: '/shellies_icon.jpg',
        headers: browserCachedAssetHeaders,
      },
      {
        source: '/spts-icon.png',
        headers: browserCachedAssetHeaders,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'explorer.inkonchain.com',
      },
      // IPFS Gateways for NFT images
      {
        protocol: 'https',
        hostname: 'cloudflare-ipfs.com',
      },
      {
        protocol: 'https',
        hostname: 'gateway.pinata.cloud',
      },
      {
        protocol: 'https',
        hostname: 'ipfs.io',
      },
      {
        protocol: 'https',
        hostname: 'gateway.ipfs.io',
      },
      {
        protocol: 'https',
        hostname: 'dweb.link',
      },
      {
        protocol: 'https',
        hostname: '4everland.io',
      },
      {
        protocol: 'https',
        hostname: 'cf-ipfs.com',
      },
      // Catch-all for other sources
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      }
    ],
    unoptimized: true,
    // Add formats for better compatibility
    formats: ['image/webp', 'image/avif'],
    // Increase device sizes for better responsive images
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    // Add image sizes for layout optimization
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384]
  }
};

export default nextConfig;
