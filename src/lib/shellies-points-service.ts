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
    lastClaim: number;
    cooldown: number;
    canClaim: boolean;
    cost: bigint;
    reward: number;
  }> {
    const [lastClaimRaw, cooldownRaw, costRaw, rewardRaw] = await Promise.all([
      readContract<bigint>('lastClaimWithFees', [walletAddress as `0x${string}`]),
      readContract<bigint>('claimWithFeesCooldown'),
      readContract<bigint>('claimWithFeesCost'),
      readContract<bigint>('claimWithFeesReward'),
    ]);

    const lastClaim = Number(lastClaimRaw);
    const cooldown = Number(cooldownRaw);
    const cost = costRaw;
    const reward = Number(rewardRaw);

    const nowSec = Math.floor(Date.now() / 1000);
    let canClaim: boolean;
    if (cooldown === 0) {
      canClaim = true;
    } else {
      canClaim = nowSec >= lastClaim + cooldown;
    }

    return { lastClaim, cooldown, canClaim, cost, reward };
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
    claimWithFeesCost: string;
    claimWithFeesCostEth: string;
    claimWithFeesReward: number;
    claimWithFeesCooldown: number;
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
      claimWithFeesCostRaw,
      claimWithFeesRewardRaw,
      claimWithFeesCooldownRaw,
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
      readContract<bigint>('claimWithFeesCost'),
      readContract<bigint>('claimWithFeesReward'),
      readContract<bigint>('claimWithFeesCooldown'),
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
      // cost stored in wei; also expose as ETH string for the UI
      claimWithFeesCost: claimWithFeesCostRaw.toString(),
      claimWithFeesCostEth: ethers.formatEther(claimWithFeesCostRaw),
      claimWithFeesReward: Number(claimWithFeesRewardRaw),
      claimWithFeesCooldown: Number(claimWithFeesCooldownRaw),
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

  // costEth: ETH amount as a decimal string, e.g. "0.001"
  setClaimWithFeesCost(costEth: string) {
    return this._ownerCall('setClaimWithFeesCost(uint256)', [ethers.parseEther(costEth)]);
  },

  setClaimWithFeesReward(amount: number) {
    return this._ownerCall('setClaimWithFeesReward(uint256)', [BigInt(amount)]);
  },

  setClaimWithFeesCooldown(seconds: number) {
    return this._ownerCall('setClaimWithFeesCooldown(uint256)', [BigInt(seconds)]);
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
