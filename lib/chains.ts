import { defineChain } from "viem";
import { mainnet, optimism, polygon, arbitrum, base, avalanche, bsc, monad } from "viem/chains";
import { ROBINHOOD_USDG } from "./destination";

/** Robinhood Chain — https://docs.robinhood.com/chain/connecting/ */
export const robinhoodChain = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://rpc.mainnet.chain.robinhood.com"],
    },
  },
  blockExplorers: {
    default: {
      name: "Robinhood Explorer",
      url: "https://robinhoodchain.blockscout.com",
    },
  },
});

/** Chains shown in the payer "You pay with" dropdown. */
export const PAYER_CHAIN_IDS = new Set<number>([
  1, // Ethereum
  10, // Optimism
  56, // BNB Smart Chain
  137, // Polygon
  143, // Monad
  8453, // Base
  42161, // Arbitrum
  43114, // Avalanche
  4663, // Robinhood
]);

/**
 * Tokens allowed for payment. Includes native + common wrapped natives
 * (Across quotes use wrapped addresses for native gas tokens).
 */
export const PAYER_TOKEN_SYMBOLS = new Set([
  "ETH",
  "WETH",
  "BNB",
  "WBNB",
  "AVAX",
  "WAVAX",
  "MATIC",
  "WMATIC",
  "POL",
  "WPOL",
  "MON",
  "WMON",
  "USDC",
  "USDT",
  "USDT0",
  "DAI",
  "CRVUSD",
]);

/** Display native-looking labels for wrapped gas tokens. */
export function displayTokenSymbol(symbol: string): string {
  const map: Record<string, string> = {
    WETH: "ETH",
    WBNB: "BNB",
    WAVAX: "AVAX",
    WMATIC: "MATIC",
    WPOL: "POL",
    WMON: "MON",
    USDT0: "USDT",
  };
  return map[symbol.toUpperCase()] ?? symbol;
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/**
 * Tokens a payer can select. Robinhood is limited to WETH (shown as ETH) and USDG.
 * Other chains keep the shared allowlist, and USDG stays off those chains.
 */
export function isPayerTokenAllowed(symbol: string, address: string, chainId?: number): boolean {
  const normalized = address.toLowerCase();
  // Prefer wrapped natives for Across; skip zero-address native placeholders.
  if (normalized === ZERO_ADDRESS) return false;
  const upper = symbol.toUpperCase();
  if (chainId === robinhoodChain.id) {
    if (upper === "USDG") return normalized === ROBINHOOD_USDG.address.toLowerCase();
    return upper === "WETH";
  }
  return PAYER_TOKEN_SYMBOLS.has(upper);
}

/** EVM chains exposed to payer wallets. */
export const appChains = [
  mainnet,
  optimism,
  polygon,
  arbitrum,
  base,
  avalanche,
  bsc,
  monad,
  robinhoodChain,
] as const;

export function chainName(chainId: number): string {
  const found = appChains.find((c) => c.id === chainId);
  return found?.name ?? `Chain ${chainId}`;
}
