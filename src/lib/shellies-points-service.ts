import { createPublicClient, http, defineChain } from 'viem';
import { Wallet, ethers } from 'ethers';
import { shelliesPointsAbi } from './shellies-points-abi';
import { SHELLIES_POINTS_ADDRESS } from './shellies-points-contract';

const INK_CHAIN_ID = 57073;

const inkChain = defineChain({
  id: INK_CHAIN_ID,
  name: 'Ink',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc-gel.inkonchain.com'] },
    public: { http: ['https://rpc-gel.inkonchain.com', 'https://rpc-qnd.inkonchain.com'] },
  },
  blockExplorers: {
    default: { name: 'Ink Explorer', url: 'https://explorer.inkonchain.com' },
  },
  testnet: false,
});

const publicClient = createPublicClient({
  chain: inkChain,
  transport: http('https://rpc-qnd.inkonchain.com', {
    timeout: 3000,
    retryCount: 2,
    retryDelay: 1000,
  }),
});

const backupClient = createPublicClient({
  chain: inkChain,
  transport: http('https://rpc-gel.inkonchain.com', {
    timeout: 5000,
    retryCount: 1,
    retryDelay: 2000,
  }),
});

async function callWithFallback<T>(
  primary: () => Promise<T>,
  backup: () => Promise<T>
): Promise<T> {
  try {
    return await primary();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('429') || msg.includes('Rate limit')) {
      await new Promise(r => setTimeout(r, 500));
      return backup();
    }
    throw err;
  }
}

function readContract<T>(functionName: string, args: unknown[] = []): Promise<T> {
  return callWithFallback(
    () => publicClient.readContract({
      address: SHELLIES_POINTS_ADDRESS,
      abi: shelliesPointsAbi,
      functionName: functionName as never,
      args: args as never,
    }) as Promise<T>,
    () => backupClient.readContract({
      address: SHELLIES_POINTS_ADDRESS,
      abi: shelliesPointsAbi,
      functionName: functionName as never,
      args: args as never,
    }) as Promise<T>
  );
}

export const ShelliesPointsService = {
  async getBalance(walletAddress: string): Promise<number> {
    const balance = await readContract<bigint>('balanceOf', [walletAddress as `0x${string}`]);
    return Number(balance);
  },

  async getClaimStatus(walletAddress: string): Promise<{
    lastClaim: number;
    cooldown: number;
    canClaim: boolean;
    secondsRemaining: number;
  }> {
    const [lastClaimRaw, cooldownRaw] = await Promise.all([
      readContract<bigint>('lastClaim', [walletAddress as `0x${string}`]),
      readContract<bigint>('claimCooldown'),
    ]);

    const lastClaim = Number(lastClaimRaw);
    const cooldown = Number(cooldownRaw);
    const nowSec = Math.floor(Date.now() / 1000);
    const nextClaim = lastClaim + cooldown;
    const secondsRemaining = Math.max(0, nextClaim - nowSec);
    const canClaim = secondsRemaining === 0;

    return { lastClaim, cooldown, canClaim, secondsRemaining };
  },

  async getClaimWithFeesStatus(walletAddress: string): Promise<{
    lastClaimStaker: number;
    lastClaimHolder: number;
    lastClaimRegular: number;
    stakerTier: { cost: bigint; pointsPerStakedNFT: number; cooldown: number };
    holderTier: { cost: bigint; pointsPerHeldNFT: number; cooldown: number };
    regularTier: { cost: bigint; reward: number; cooldown: number };
  }> {
    const [
      lastClaimStakerRaw,
      lastClaimHolderRaw,
      lastClaimRegularRaw,
      stakerTierCostRaw,
      pointsPerStakedNFTRaw,
      stakerTierCooldownRaw,
      holderTierCostRaw,
      pointsPerHeldNFTRaw,
      holderTierCooldownRaw,
      regularTierCostRaw,
      rewardPerRegularUserRaw,
      regularTierCooldownRaw,
    ] = await Promise.all([
      readContract<bigint>('lastClaimStakerTier', [walletAddress as `0x${string}`]),
      readContract<bigint>('lastClaimHolderTier', [walletAddress as `0x${string}`]),
      readContract<bigint>('lastClaimRegularTier', [walletAddress as `0x${string}`]),
      readContract<bigint>('stakerTierCost'),
      readContract<bigint>('pointsPerStakedNFT'),
      readContract<bigint>('stakerTierCooldown'),
      readContract<bigint>('holderTierCost'),
      readContract<bigint>('pointsPerHeldNFT'),
      readContract<bigint>('holderTierCooldown'),
      readContract<bigint>('regularTierCost'),
      readContract<bigint>('rewardPerRegularUser'),
      readContract<bigint>('regularTierCooldown'),
    ]);

    return {
      lastClaimStaker: Number(lastClaimStakerRaw),
      lastClaimHolder: Number(lastClaimHolderRaw),
      lastClaimRegular: Number(lastClaimRegularRaw),
      stakerTier: {
        cost: stakerTierCostRaw,
        pointsPerStakedNFT: Number(pointsPerStakedNFTRaw),
        cooldown: Number(stakerTierCooldownRaw),
      },
      holderTier: {
        cost: holderTierCostRaw,
        pointsPerHeldNFT: Number(pointsPerHeldNFTRaw),
        cooldown: Number(holderTierCooldownRaw),
      },
      regularTier: {
        cost: regularTierCostRaw,
        reward: Number(rewardPerRegularUserRaw),
        cooldown: Number(regularTierCooldownRaw),
      },
    };
  },

  async signConvertXpVoucher(
    walletAddress: string,
    xpAmount: number,
    nonce: number,
    expiry: number
  ): Promise<string> {
    const privateKey = process.env.AUTHORIZED_SIGNER_PRIVATE_KEY;
    if (!privateKey) throw new Error('AUTHORIZED_SIGNER_PRIVATE_KEY not configured');

    const signerWallet = new Wallet(privateKey);

    const messageHash = ethers.solidityPackedKeccak256(
      ['address', 'uint256', 'uint256', 'uint256', 'uint256'],
      [walletAddress, xpAmount, nonce, expiry, INK_CHAIN_ID]
    );

    const signature = await signerWallet.signMessage(ethers.getBytes(messageHash));
    return signature;
  },

  async adminMint(walletAddress: string, amount: number): Promise<string> {
    const privateKey = process.env.OWNER_PRIVATE_KEY;
    if (!privateKey) throw new Error('OWNER_PRIVATE_KEY not configured');

    const provider = new ethers.JsonRpcProvider('https://rpc-qnd.inkonchain.com');
    const ownerWallet = new Wallet(privateKey, provider);
    const contract = new ethers.Contract(
      SHELLIES_POINTS_ADDRESS,
      ['function adminMint(address user, uint256 amount) external'],
      ownerWallet
    );

    const tx = await contract.adminMint(walletAddress, BigInt(amount));
    await tx.wait();
    return tx.hash as string;
  },

  async adminBurn(walletAddress: string, amount: number): Promise<string> {
    const privateKey = process.env.OWNER_PRIVATE_KEY;
    if (!privateKey) throw new Error('OWNER_PRIVATE_KEY not configured');

    const provider = new ethers.JsonRpcProvider('https://rpc-qnd.inkonchain.com');
    const ownerWallet = new Wallet(privateKey, provider);
    const contract = new ethers.Contract(
      SHELLIES_POINTS_ADDRESS,
      ['function adminBurn(address user, uint256 amount) external'],
      ownerWallet
    );

    const tx = await contract.adminBurn(walletAddress, BigInt(amount));
    await tx.wait();
    return tx.hash as string;
  },

  // ─── Config reads ────────────────────────────────────────────────────────

  async getContractConfig(): Promise<{
    claimCooldown: number;
    pointsForRegularUser: number;
    pointsPerAvailableNFT: number;
    maxPointsPerClaim: number;
    pointsPerDailyStakedNFT: number;
    pointsPerWeeklyStakedNFT: number;
    pointsPerMonthlyStakedNFT: number;
    stakerTierCost: string;
    stakerTierCostEth: string;
    pointsPerStakedNFT: number;
    stakerTierCooldown: number;
    holderTierCost: string;
    holderTierCostEth: string;
    pointsPerHeldNFT: number;
    holderTierCooldown: number;
    regularTierCost: string;
    regularTierCostEth: string;
    rewardPerRegularUser: number;
    regularTierCooldown: number;
    xpConversionRate: number;
    minXpToConvert: number;
    authorizedSigner: string;
  }> {
    const [
      claimCooldownRaw,
      pointsForRegularUserRaw,
      pointsPerAvailableNFTRaw,
      maxPointsPerClaimRaw,
      pointsPerDailyRaw,
      pointsPerWeeklyRaw,
      pointsPerMonthlyRaw,
      stakerTierCostRaw,
      pointsPerStakedNFTRaw,
      stakerTierCooldownRaw,
      holderTierCostRaw,
      pointsPerHeldNFTRaw,
      holderTierCooldownRaw,
      regularTierCostRaw,
      rewardPerRegularUserRaw,
      regularTierCooldownRaw,
      xpConversionRateRaw,
      minXpToConvertRaw,
      authorizedSignerRaw,
    ] = await Promise.all([
      readContract<bigint>('claimCooldown'),
      readContract<bigint>('pointsForRegularUser'),
      readContract<bigint>('pointsPerAvailableNFT'),
      readContract<bigint>('maxPointsPerClaim'),
      readContract<bigint>('pointsPerDailyStakedNFT'),
      readContract<bigint>('pointsPerWeeklyStakedNFT'),
      readContract<bigint>('pointsPerMonthlyStakedNFT'),
      readContract<bigint>('stakerTierCost'),
      readContract<bigint>('pointsPerStakedNFT'),
      readContract<bigint>('stakerTierCooldown'),
      readContract<bigint>('holderTierCost'),
      readContract<bigint>('pointsPerHeldNFT'),
      readContract<bigint>('holderTierCooldown'),
      readContract<bigint>('regularTierCost'),
      readContract<bigint>('rewardPerRegularUser'),
      readContract<bigint>('regularTierCooldown'),
      readContract<bigint>('xpConversionRate'),
      readContract<bigint>('minXpToConvert'),
      readContract<string>('authorizedSigner'),
    ]);

    return {
      claimCooldown: Number(claimCooldownRaw),
      pointsForRegularUser: Number(pointsForRegularUserRaw),
      pointsPerAvailableNFT: Number(pointsPerAvailableNFTRaw),
      maxPointsPerClaim: Number(maxPointsPerClaimRaw),
      pointsPerDailyStakedNFT: Number(pointsPerDailyRaw),
      pointsPerWeeklyStakedNFT: Number(pointsPerWeeklyRaw),
      pointsPerMonthlyStakedNFT: Number(pointsPerMonthlyRaw),
      stakerTierCost: stakerTierCostRaw.toString(),
      stakerTierCostEth: ethers.formatEther(stakerTierCostRaw),
      pointsPerStakedNFT: Number(pointsPerStakedNFTRaw),
      stakerTierCooldown: Number(stakerTierCooldownRaw),
      holderTierCost: holderTierCostRaw.toString(),
      holderTierCostEth: ethers.formatEther(holderTierCostRaw),
      pointsPerHeldNFT: Number(pointsPerHeldNFTRaw),
      holderTierCooldown: Number(holderTierCooldownRaw),
      regularTierCost: regularTierCostRaw.toString(),
      regularTierCostEth: ethers.formatEther(regularTierCostRaw),
      rewardPerRegularUser: Number(rewardPerRegularUserRaw),
      regularTierCooldown: Number(regularTierCooldownRaw),
      xpConversionRate: Number(xpConversionRateRaw),
      minXpToConvert: Number(minXpToConvertRaw),
      authorizedSigner: authorizedSignerRaw as string,
    };
  },

  // ─── Config writes (owner-only, use OWNER_PRIVATE_KEY) ───────────────────

  async _ownerCall(functionSig: string, args: unknown[]): Promise<string> {
    const privateKey = process.env.OWNER_PRIVATE_KEY;
    if (!privateKey) throw new Error('OWNER_PRIVATE_KEY not configured');
    const provider = new ethers.JsonRpcProvider('https://rpc-qnd.inkonchain.com');
    const ownerWallet = new Wallet(privateKey, provider);
    const contract = new ethers.Contract(
      SHELLIES_POINTS_ADDRESS,
      [`function ${functionSig} external`],
      ownerWallet
    );
    const fnName = functionSig.split('(')[0];
    const tx = await contract[fnName](...args);
    await tx.wait();
    return tx.hash as string;
  },

  setClaimCooldown(seconds: number) {
    return this._ownerCall('setClaimCooldown(uint256)', [BigInt(seconds)]);
  },

  setPointsForRegularUser(amount: number) {
    return this._ownerCall('setPointsForRegularUser(uint256)', [BigInt(amount)]);
  },

  setPointsPerAvailableNFT(amount: number) {
    return this._ownerCall('setPointsPerAvailableNFT(uint256)', [BigInt(amount)]);
  },

  setMaxPointsPerClaim(amount: number) {
    return this._ownerCall('setMaxPointsPerClaim(uint256)', [BigInt(amount)]);
  },

  setPointsPerDailyStakedNFT(amount: number) {
    return this._ownerCall('setPointsPerDailyStakedNFT(uint256)', [BigInt(amount)]);
  },

  setPointsPerWeeklyStakedNFT(amount: number) {
    return this._ownerCall('setPointsPerWeeklyStakedNFT(uint256)', [BigInt(amount)]);
  },

  setPointsPerMonthlyStakedNFT(amount: number) {
    return this._ownerCall('setPointsPerMonthlyStakedNFT(uint256)', [BigInt(amount)]);
  },

  setStakerTierCost(costEth: string) {
    return this._ownerCall('setStakerTierCost(uint256)', [ethers.parseEther(costEth)]);
  },

  setPointsPerStakedNFT(amount: number) {
    return this._ownerCall('setPointsPerStakedNFT(uint256)', [BigInt(amount)]);
  },

  setStakerTierCooldown(seconds: number) {
    return this._ownerCall('setStakerTierCooldown(uint256)', [BigInt(seconds)]);
  },

  setHolderTierCost(costEth: string) {
    return this._ownerCall('setHolderTierCost(uint256)', [ethers.parseEther(costEth)]);
  },

  setPointsPerHeldNFT(amount: number) {
    return this._ownerCall('setPointsPerHeldNFT(uint256)', [BigInt(amount)]);
  },

  setHolderTierCooldown(seconds: number) {
    return this._ownerCall('setHolderTierCooldown(uint256)', [BigInt(seconds)]);
  },

  setRegularTierCost(costEth: string) {
    return this._ownerCall('setRegularTierCost(uint256)', [ethers.parseEther(costEth)]);
  },

  setRewardPerRegularUser(amount: number) {
    return this._ownerCall('setRewardPerRegularUser(uint256)', [BigInt(amount)]);
  },

  setRegularTierCooldown(seconds: number) {
    return this._ownerCall('setRegularTierCooldown(uint256)', [BigInt(seconds)]);
  },

  setXpConversionRate(rate: number) {
    return this._ownerCall('setXpConversionRate(uint256)', [BigInt(rate)]);
  },

  setMinXpToConvert(minXp: number) {
    return this._ownerCall('setMinXpToConvert(uint256)', [BigInt(minXp)]);
  },

  setAuthorizedSigner(address: string) {
    return this._ownerCall('setAuthorizedSigner(address)', [address]);
  },

  withdrawFees() {
    return this._ownerCall('withdrawFees()', []);
  },
};
