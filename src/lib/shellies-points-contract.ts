// AUTO-GENERATED — do not edit manually. Run: npm run compile:abis
import { shelliesPointsAbi } from './shellies-points-abi';

export const SHELLIES_POINTS_ADDRESS = (
  process.env.NEXT_PUBLIC_SHELLIES_POINTS_CONTRACT_ADDRESS || '0x'
) as `0x${string}`;

export const SHELLIES_POINTS_CONTRACT = {
  address: SHELLIES_POINTS_ADDRESS,
  abi: shelliesPointsAbi,
} as const;
