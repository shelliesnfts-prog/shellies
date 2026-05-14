export const EXPLORER_BASE = 'https://explorer.inkonchain.com';

export const SP_TOKEN_ADDRESS =
  process.env.NEXT_PUBLIC_SHELLIES_POINTS_CONTRACT_ADDRESS ?? '';

export const GAME_PAYMENT_ADDRESS =
  process.env.NEXT_PUBLIC_GAME_PAYMENT_CONTRACT_ADDRESS ??
  process.env.NEXT_PUBLIC_GAME_PAYMENT_CONTRACT ??
  '';

export function explorerAddress(addr: string): string {
  return `${EXPLORER_BASE}/address/${addr}`;
}

export function explorerToken(addr: string): string {
  return `${EXPLORER_BASE}/token/${addr}`;
}

export function shortAddress(addr: string, head = 6, tail = 4): string {
  if (!addr) return '';
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}
