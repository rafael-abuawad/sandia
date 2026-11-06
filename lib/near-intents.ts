import { STELLAR_USDC } from "./stellar/constants";

export const ONE_CLICK_URL = "https://1click.chaindefuser.com";
export const STELLAR_USDC_ASSET_ID =
  "nep245:v2_1.omni.hot.tg:1100_111bzQBB65GxAPAVoxqmMcgYo5oS3txhqs1Uh1cgahKQUeTUq1TJu";

/** Networks offered on the pay page, in display order. */
export const PAY_NETWORKS: Record<string, string> = {
  eth: "Ethereum",
  base: "Base",
  arb: "Arbitrum",
  op: "Optimism",
  pol: "Polygon",
  bsc: "BNB Chain",
  avax: "Avalanche",
  monad: "Monad",
  sol: "Solana",
  btc: "Bitcoin",
  tron: "Tron",
};

const PAY_SYMBOLS = new Set(["USDC", "USDT", "ETH", "BNB", "AVAX", "POL", "MON", "SOL", "BTC"]);

export type OneClickToken = {
  assetId: string;
  decimals: number;
  blockchain: string;
  symbol: string;
  contractAddress?: string;
};

export type PayRoute = {
  assetId: string;
  symbol: string;
  decimals: number;
  blockchain: string;
  network: string;
};

/** Keeps supported networks and common tokens. Stellar itself pays directly, without a route. */
export function toPayRoutes(tokens: OneClickToken[]): PayRoute[] {
  const networkOrder = Object.keys(PAY_NETWORKS);
  const symbolOrder = [...PAY_SYMBOLS];
  return tokens
    .filter((token) => PAY_NETWORKS[token.blockchain] && PAY_SYMBOLS.has(token.symbol))
    .map((token) => ({
      assetId: token.assetId,
      symbol: token.symbol,
      decimals: token.decimals,
      blockchain: token.blockchain,
      network: PAY_NETWORKS[token.blockchain],
    }))
    .sort(
      (a, b) =>
        networkOrder.indexOf(a.blockchain) - networkOrder.indexOf(b.blockchain) ||
        symbolOrder.indexOf(a.symbol) - symbolOrder.indexOf(b.symbol),
    );
}

/** The live Stellar USDC asset, confirmed by issuer, so a renamed token can't become the target. */
export function findStellarUsdc(tokens: OneClickToken[]): OneClickToken | null {
  return (
    tokens.find(
      (token) =>
        token.blockchain === "stellar" &&
        token.symbol === STELLAR_USDC.symbol &&
        token.contractAddress === STELLAR_USDC.issuer,
    ) ?? null
  );
}

export type QuoteRequestInput = {
  originAsset: string;
  destinationAsset: string;
  amountStroops: string;
  recipient: string;
  refundTo: string;
  deadline: number;
};

/**
 * EXACT_OUTPUT: the recipient gets exactly the requested USDC. Slippage applies to the input, and
 * any excess is refunded to the payer. Note that 1Click needs the recipient's USDC trustline.
 */
export function buildQuoteBody(input: QuoteRequestInput) {
  return {
    dry: false,
    swapType: "EXACT_OUTPUT",
    slippageTolerance: 100,
    originAsset: input.originAsset,
    depositType: "ORIGIN_CHAIN",
    destinationAsset: input.destinationAsset,
    amount: input.amountStroops,
    refundTo: input.refundTo,
    refundType: "ORIGIN_CHAIN",
    recipient: input.recipient,
    recipientType: "DESTINATION_CHAIN",
    deadline: new Date(input.deadline).toISOString(),
    quoteWaitingTimeMs: 3000,
    referral: "sandia",
  };
}

export type OneClickQuote = {
  correlationId?: string;
  signature?: string;
  quote: {
    depositAddress?: string;
    depositMemo?: string;
    amountIn: string;
    minAmountIn: string;
    amountOut: string;
    minAmountOut: string;
    timeEstimate: number;
  };
};

/** Rejects a quote that wouldn't deliver the full amount or has no deposit address. */
export function assertUsableQuote(
  response: OneClickQuote,
  amountStroops: string,
): asserts response is OneClickQuote & {
  quote: OneClickQuote["quote"] & { depositAddress: string };
} {
  if (!response.quote?.depositAddress) throw new Error("No route is available for this token.");
  if (BigInt(response.quote.minAmountOut) < BigInt(amountStroops)) {
    throw new Error("No route is available for this token.");
  }
}

/** Addresses of the Stellar transactions a successful swap delivered through. */
export function destinationHashes(status: {
  swapDetails?: { destinationChainTxHashes?: Array<{ hash?: string }> };
}): string[] {
  return (status.swapDetails?.destinationChainTxHashes ?? [])
    .map((row) => row.hash?.toLowerCase() ?? "")
    .filter((hash) => /^[0-9a-f]{64}$/.test(hash));
}
