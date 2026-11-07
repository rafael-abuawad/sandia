const TOKEN_ICONS: Record<string, string> = {
  USDC: "/assets/tokens/usdc.svg",
  USDT: "/assets/tokens/usdt.svg",
  ETH: "/assets/tokens/eth.svg",
  BNB: "/assets/tokens/bnb.svg",
  AVAX: "/assets/tokens/avax.svg",
  POL: "/assets/tokens/pol.svg",
  MON: "/assets/tokens/mon.svg",
};

const CHAIN_NAME_ICONS: Record<string, string> = {
  stellar: "/assets/chains/stellar.svg",
  ethereum: "/assets/chains/ethereum.svg",
  optimism: "/assets/chains/optimism.svg",
  base: "/assets/chains/base.svg",
  arbitrum: "/assets/chains/arbitrum.svg",
  polygon: "/assets/chains/polygon.svg",
  avalanche: "/assets/chains/avalanche.svg",
  "bnb chain": "/assets/chains/bsc.svg",
  monad: "/assets/chains/monad.svg",
};

export function resolveChainIcon(
  chainName?: string | null,
  fallback?: string | null,
): string | null {
  if (chainName) {
    const mapped = CHAIN_NAME_ICONS[chainName.trim().toLowerCase()];
    if (mapped) return mapped;
  }
  return fallback || null;
}

export function resolveTokenIcon(symbol: string, fallback?: string | null): string | null {
  return TOKEN_ICONS[symbol.toUpperCase()] ?? fallback ?? null;
}
