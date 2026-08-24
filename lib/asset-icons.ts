import { displayTokenSymbol } from "@/lib/chains";

const CHAIN_ICONS: Record<number, string> = {
  1: "/assets/chains/ethereum.svg",
  10: "/assets/chains/optimism.svg",
  56: "/assets/chains/bsc.svg",
  137: "/assets/chains/polygon.svg",
  143: "/assets/chains/monad.svg",
  8453: "/assets/chains/base.svg",
  42161: "/assets/chains/arbitrum.svg",
  43114: "/assets/chains/avalanche.svg",
  4663: "/assets/chains/robinhood.svg",
};

const TOKEN_ICONS: Record<string, string> = {
  USDG: "/assets/tokens/usdg.svg",
  USDC: "/assets/tokens/usdc.svg",
  USDT: "/assets/tokens/usdt.svg",
  DAI: "/assets/tokens/dai.svg",
  ETH: "/assets/tokens/eth.svg",
  BNB: "/assets/chains/bsc.svg",
  AVAX: "/assets/chains/avalanche.svg",
  MATIC: "/assets/chains/polygon.svg",
  POL: "/assets/chains/polygon.svg",
  MON: "/assets/chains/monad.svg",
};

const CHAIN_NAME_ICONS: Record<string, string> = {
  ethereum: "/assets/chains/ethereum.svg",
  "ethereum mainnet": "/assets/chains/ethereum.svg",
  optimism: "/assets/chains/optimism.svg",
  "op mainnet": "/assets/chains/optimism.svg",
  base: "/assets/chains/base.svg",
  arbitrum: "/assets/chains/arbitrum.svg",
  "arbitrum one": "/assets/chains/arbitrum.svg",
  polygon: "/assets/chains/polygon.svg",
  avalanche: "/assets/chains/avalanche.svg",
  bsc: "/assets/chains/bsc.svg",
  "bnb smart chain": "/assets/chains/bsc.svg",
  monad: "/assets/chains/monad.svg",
  robinhood: "/assets/chains/robinhood.svg",
  "robinhood chain": "/assets/chains/robinhood.svg",
};

export function resolveChainIcon(
  chainId?: number | null,
  chainName?: string | null,
  fallback?: string | null,
): string | null {
  if (chainId != null && CHAIN_ICONS[chainId]) return CHAIN_ICONS[chainId];
  if (chainName) {
    const mapped = CHAIN_NAME_ICONS[chainName.trim().toLowerCase()];
    if (mapped) return mapped;
  }
  return fallback || null;
}

export function resolveTokenIcon(symbol: string, fallback?: string | null): string | null {
  const display = displayTokenSymbol(symbol).toUpperCase();
  return TOKEN_ICONS[display] ?? TOKEN_ICONS[symbol.toUpperCase()] ?? fallback ?? null;
}
