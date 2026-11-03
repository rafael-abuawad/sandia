import { defineChain } from "viem";
import { mainnet, optimism, polygon, arbitrum, base, avalanche, bsc, monad } from "viem/chains";

/** HyperEVM. Payers can pay from here; Across forwards to HyperCore. */
export const hyperEvm = defineChain({
  id: 999,
  name: "HyperEVM",
  nativeCurrency: { name: "HYPE", symbol: "HYPE", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.hyperliquid.xyz/evm"] } },
  blockExplorers: { default: { name: "HyperEVMScan", url: "https://hyperevmscan.io" } },
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
  999, // HyperEVM
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
  "HYPE",
  "WHYPE",
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
    WHYPE: "HYPE",
    USDT0: "USDT",
  };
  return map[symbol.toUpperCase()] ?? symbol;
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/** Gas tokens pay only from their own chain. Across also lists bridged ERC-20 copies elsewhere. */
const GAS_TOKEN_HOME_CHAIN: Record<string, number> = {
  BNB: 56,
  WBNB: 56,
  AVAX: 43114,
  WAVAX: 43114,
  MATIC: 137,
  WMATIC: 137,
  POL: 137,
  WPOL: 137,
  MON: 143,
  WMON: 143,
  HYPE: 999,
  WHYPE: 999,
};

function isEthNativeChain(chainId: number | undefined): boolean {
  return appChains.some((c) => c.id === chainId && c.nativeCurrency.symbol === "ETH");
}

/**
 * Tokens a payer can select. On ETH-native chains, native ETH replaces WETH: Across wraps
 * it in the deposit, so the payer needs no WETH balance or approval. HYPE pays natively on
 * HyperEVM. Other chains keep the shared allowlist.
 */
export function isPayerTokenAllowed(symbol: string, address: string, chainId?: number): boolean {
  const normalized = address.toLowerCase();
  const upper = symbol.toUpperCase();
  if (isEthNativeChain(chainId)) {
    if (upper === "ETH") return normalized === ZERO_ADDRESS;
    if (upper === "WETH") return false;
  }
  if (chainId === hyperEvm.id) {
    if (upper === "HYPE") return normalized === ZERO_ADDRESS;
    if (upper === "WHYPE") return false;
  }
  const home = GAS_TOKEN_HOME_CHAIN[upper];
  if (home !== undefined && home !== chainId) return false;
  if (normalized === ZERO_ADDRESS) return false;
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
  hyperEvm,
] as const;

export function chainName(chainId: number): string {
  const found = appChains.find((c) => c.id === chainId);
  return found?.name ?? `Chain ${chainId}`;
}

const TX_HASH = /^0x[0-9a-fA-F]{64}$/;

/** Block explorer URL for a transaction. */
export function explorerTxUrl(chainId: number, hash: string): string | null {
  if (!TX_HASH.test(hash)) return null;
  const base = appChains.find((chain) => chain.id === chainId)?.blockExplorers?.default.url;
  if (!base) return null;
  return `${base}/tx/${hash}`;
}
