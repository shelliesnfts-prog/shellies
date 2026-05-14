export const HIDDEN_LEADERBOARD_WALLETS = [
  '0x4b40700e0fe455e39fd0d6e9c5b2a0f0ee77916f',
];

const hiddenLeaderboardWallets = new Set(HIDDEN_LEADERBOARD_WALLETS);

export function isHiddenLeaderboardWallet(walletAddress?: string | null): boolean {
  return Boolean(walletAddress && hiddenLeaderboardWallets.has(walletAddress.toLowerCase()));
}
