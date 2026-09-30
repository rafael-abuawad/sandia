import {
  BaseError,
  ContractFunctionRevertedError,
  decodeFunctionData,
  encodeFunctionData,
  erc20Abi,
  getAddress,
  parseAbi,
  zeroAddress,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
import { ROBINHOOD_USDG } from "@/lib/destination";

/** Uniswap contracts deployed on Robinhood Chain (4663). */
export const QUOTER_V2 = getAddress("0x33e885eD0Ec9bF04EcfB19341582aADCb4c8A9E7");
export const SWAP_ROUTER_02 = getAddress("0xCaf681a66D020601342297493863E78C959E5cb2");
export const V3_FACTORY = getAddress("0x1f7d7550B1b028f7571E69A784071F0205FD2EfA");
/** SwapRouter02 was constructed with this v2 factory. */
export const V2_FACTORY = getAddress("0x8bcEaA40B9AcdfAedF85AdF4FF01F5Ad6517937f");

export const V3_FEE_TIERS = [500, 3000] as const;
export type V3FeeTier = (typeof V3_FEE_TIERS)[number];

export const SWAP_DEADLINE_SECONDS = 120n;
const USDG = getAddress(ROBINHOOD_USDG.address);

export const quoterV2Abi = parseAbi([
  "function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) view returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
  "function quoteExactOutputSingle((address tokenIn, address tokenOut, uint256 amount, uint24 fee, uint160 sqrtPriceLimitX96) params) view returns (uint256 amountIn, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
]);

export const swapRouterAbi = parseAbi([
  "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)",
  "function exactOutputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountOut, uint256 amountInMaximum, uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountIn)",
  "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to) payable returns (uint256 amountOut)",
  "function swapTokensForExactTokens(uint256 amountOut, uint256 amountInMax, address[] path, address to) payable returns (uint256 amountIn)",
  "function multicall(uint256 deadline, bytes[] data) payable returns (bytes[] results)",
]);

const v3FactoryAbi = parseAbi([
  "function getPool(address tokenA, address tokenB, uint24 fee) view returns (address pool)",
]);

const v2FactoryAbi = parseAbi([
  "function getPair(address tokenA, address tokenB) view returns (address pair)",
]);

const v2PairAbi = parseAbi([
  "function token0() view returns (address)",
  "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
]);

export type TradeSide = "buy" | "sell";
export type TradeUnit = "usd" | "shares";
export type TradeDirection = "exactIn" | "exactOut";

export type StockVenue = { kind: "v3"; fee: V3FeeTier } | { kind: "v2" };

export type CandidateQuote = {
  venue: StockVenue;
  /** amountOut for exact-in, amountIn for exact-out. Zero means no liquidity. */
  amount: bigint;
};

export type PlannedStockOrder = {
  direction: TradeDirection;
  tokenIn: Address;
  tokenOut: Address;
  amount: bigint;
};

export type ProtectedStockQuote = PlannedStockOrder & {
  quoted: bigint;
  /** amountOutMinimum for exact-in, amountInMaximum for exact-out. */
  protected: bigint;
  venue: StockVenue;
  sellToken: Address;
  sellAmount: bigint;
};

export type StockCall = {
  to: Address;
  data: Hex;
  value: bigint;
};

export function planStockOrder(input: {
  side: TradeSide;
  unit: TradeUnit;
  token: Address;
  amount: bigint;
}): PlannedStockOrder {
  const token = getAddress(input.token);
  if (token === USDG) throw new Error("Choose a token other than USDG.");
  if (input.amount <= 0n) throw new Error("Amount must be greater than zero");
  if (input.side === "buy" && input.unit === "usd") {
    return { direction: "exactIn", tokenIn: USDG, tokenOut: token, amount: input.amount };
  }
  if (input.side === "sell" && input.unit === "usd") {
    return { direction: "exactOut", tokenIn: token, tokenOut: USDG, amount: input.amount };
  }
  if (input.side === "buy" && input.unit === "shares") {
    return { direction: "exactOut", tokenIn: USDG, tokenOut: token, amount: input.amount };
  }
  return { direction: "exactIn", tokenIn: token, tokenOut: USDG, amount: input.amount };
}

/**
 * Exact-in protection rounds down. A 1-unit quote cannot be protected and is skipped.
 * Exact-out protection rounds up so the cap is at least 1% above the quote.
 */
export function amountOutMinimum(amountOut: bigint): bigint | null {
  if (amountOut <= 0n) return null;
  const minimum = (amountOut * 99n) / 100n;
  return minimum > 0n ? minimum : null;
}

export function amountInMaximum(amountIn: bigint): bigint | null {
  if (amountIn <= 0n) return null;
  return (amountIn * 101n + 99n) / 100n;
}

export function protectQuotedAmount(direction: TradeDirection, quoted: bigint): bigint | null {
  return direction === "exactIn" ? amountOutMinimum(quoted) : amountInMaximum(quoted);
}

/** True when the fresh protected amount is a worse deal than the one on screen. */
export function protectedQuoteWorsened(
  direction: TradeDirection,
  shown: bigint,
  next: bigint,
): boolean {
  return direction === "exactIn" ? next < shown : next > shown;
}

/**
 * Keeps the live pool with the best amount.
 * Exact-in wants the largest output. Exact-out wants the smallest input.
 * A zero amount is an empty pool and is skipped. Reverted tiers are omitted by the caller.
 */
export function chooseProtectedQuote(
  candidates: readonly CandidateQuote[],
  direction: TradeDirection,
): { venue: StockVenue; quoted: bigint; protected: bigint } | null {
  const ranked = candidates
    .filter((candidate) => candidate.amount > 0n)
    .sort((a, b) => {
      if (a.amount === b.amount) return 0;
      if (direction === "exactIn") return a.amount > b.amount ? -1 : 1;
      return a.amount < b.amount ? -1 : 1;
    });
  for (const candidate of ranked) {
    const protectedAmount = protectQuotedAmount(direction, candidate.amount);
    if (protectedAmount === null) continue;
    return { venue: candidate.venue, quoted: candidate.amount, protected: protectedAmount };
  }
  return null;
}

export function swapDeadline(nowSeconds: bigint): bigint {
  return nowSeconds + SWAP_DEADLINE_SECONDS;
}

/** Stock swaps may be sent only to SwapRouter02, with no native ETH attached. */
export function requireSwapRouterCall(call: StockCall): StockCall {
  if (getAddress(call.to) !== SWAP_ROUTER_02) {
    throw new Error("Stock trades submit only to SwapRouter02");
  }
  if (call.value !== 0n) {
    throw new Error("Stock trades send no native ETH");
  }
  if (!call.data || call.data === "0x") {
    throw new Error("Stock trades need swap calldata");
  }
  const outer = decodeFunctionData({ abi: swapRouterAbi, data: call.data });
  if (outer.functionName !== "multicall") {
    throw new Error("Stock trades submit only to SwapRouter02");
  }
  return call;
}

export function buildStockApprove(token: Address, amount: bigint): StockCall {
  const sellToken = getAddress(token);
  if (sellToken === SWAP_ROUTER_02) {
    throw new Error("Approve the sell token, not SwapRouter02");
  }
  if (amount <= 0n) throw new Error("Approval amount must be greater than zero");
  return {
    to: sellToken,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      args: [SWAP_ROUTER_02, amount],
    }),
    value: 0n,
  };
}

export function buildStockSwap(input: {
  direction: TradeDirection;
  venue: StockVenue;
  tokenIn: Address;
  tokenOut: Address;
  amount: bigint;
  quoted: bigint;
  recipient: Address;
  nowSeconds: bigint;
}): StockCall {
  const tokenIn = getAddress(input.tokenIn);
  const tokenOut = getAddress(input.tokenOut);
  const recipient = getAddress(input.recipient);
  if (tokenIn === tokenOut) throw new Error("Choose a token other than USDG.");
  if (input.amount <= 0n || input.quoted <= 0n) {
    throw new Error("Amount must be greater than zero");
  }
  const protectedAmount = protectQuotedAmount(input.direction, input.quoted);
  if (protectedAmount === null) throw new Error("Quoted amount is too small to protect");
  const inner = encodeInnerSwap({
    direction: input.direction,
    venue: input.venue,
    tokenIn,
    tokenOut,
    amount: input.amount,
    protectedAmount,
    recipient,
  });
  const data = encodeFunctionData({
    abi: swapRouterAbi,
    functionName: "multicall",
    args: [swapDeadline(input.nowSeconds), [inner]],
  });
  return requireSwapRouterCall({ to: SWAP_ROUTER_02, data, value: 0n });
}

function encodeInnerSwap(input: {
  direction: TradeDirection;
  venue: StockVenue;
  tokenIn: Address;
  tokenOut: Address;
  amount: bigint;
  protectedAmount: bigint;
  recipient: Address;
}): Hex {
  if (input.venue.kind === "v3" && input.direction === "exactIn") {
    return encodeFunctionData({
      abi: swapRouterAbi,
      functionName: "exactInputSingle",
      args: [
        {
          tokenIn: input.tokenIn,
          tokenOut: input.tokenOut,
          fee: input.venue.fee,
          recipient: input.recipient,
          amountIn: input.amount,
          amountOutMinimum: input.protectedAmount,
          sqrtPriceLimitX96: 0n,
        },
      ],
    });
  }
  if (input.venue.kind === "v3") {
    return encodeFunctionData({
      abi: swapRouterAbi,
      functionName: "exactOutputSingle",
      args: [
        {
          tokenIn: input.tokenIn,
          tokenOut: input.tokenOut,
          fee: input.venue.fee,
          recipient: input.recipient,
          amountOut: input.amount,
          amountInMaximum: input.protectedAmount,
          sqrtPriceLimitX96: 0n,
        },
      ],
    });
  }
  const path = [input.tokenIn, input.tokenOut] as const;
  if (input.direction === "exactIn") {
    return encodeFunctionData({
      abi: swapRouterAbi,
      functionName: "swapExactTokensForTokens",
      args: [input.amount, input.protectedAmount, [...path], input.recipient],
    });
  }
  return encodeFunctionData({
    abi: swapRouterAbi,
    functionName: "swapTokensForExactTokens",
    args: [input.amount, input.protectedAmount, [...path], input.recipient],
  });
}

export function quoteLegs(quote: ProtectedStockQuote): {
  tokenAmount: bigint;
  usdgAmount: bigint;
} {
  if (quote.direction === "exactIn") {
    if (quote.tokenIn === USDG) return { usdgAmount: quote.amount, tokenAmount: quote.quoted };
    return { tokenAmount: quote.amount, usdgAmount: quote.quoted };
  }
  if (quote.tokenOut === USDG) return { usdgAmount: quote.amount, tokenAmount: quote.quoted };
  return { tokenAmount: quote.amount, usdgAmount: quote.quoted };
}

/** Parse a decimal field into base units. Empty and zero stay unquoted. */
export function parseTradeAmount(
  input: string,
  decimals: number,
): { amount: bigint } | { error: string } | null {
  const trimmed = input.trim().replace(/,/g, "");
  if (!trimmed) return null;
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return { error: "Enter a number." };
  const [, frac = ""] = trimmed.split(".");
  if (frac.length > decimals) {
    return { error: `Enter an amount with up to ${decimals} decimal places.` };
  }
  const [whole] = trimmed.split(".");
  const scale = 10n ** BigInt(decimals);
  const fraction = frac.length === 0 ? 0n : BigInt(frac.padEnd(decimals, "0"));
  const amount = BigInt(whole ?? "0") * scale + fraction;
  if (amount <= 0n) return null;
  return { amount };
}

function isQuoteMiss(error: unknown): boolean {
  if (error instanceof BaseError) {
    if (error.walk((item) => item instanceof ContractFunctionRevertedError)) return true;
    return /execution reverted/i.test(`${error.shortMessage} ${error.message}`);
  }
  return error instanceof Error && /execution reverted/i.test(error.message);
}

async function quoteV3(
  client: PublicClient,
  order: PlannedStockOrder,
  fee: V3FeeTier,
): Promise<CandidateQuote | null> {
  const pool = await client.readContract({
    address: V3_FACTORY,
    abi: v3FactoryAbi,
    functionName: "getPool",
    args: [order.tokenIn, order.tokenOut, fee],
  });
  if (getAddress(pool) === zeroAddress) return null;
  if (order.direction === "exactIn") {
    const [amountOut] = await client.readContract({
      address: QUOTER_V2,
      abi: quoterV2Abi,
      functionName: "quoteExactInputSingle",
      args: [
        {
          tokenIn: order.tokenIn,
          tokenOut: order.tokenOut,
          amountIn: order.amount,
          fee,
          sqrtPriceLimitX96: 0n,
        },
      ],
    });
    return amountOut > 0n ? { venue: { kind: "v3", fee }, amount: amountOut } : null;
  }
  const [amountIn] = await client.readContract({
    address: QUOTER_V2,
    abi: quoterV2Abi,
    functionName: "quoteExactOutputSingle",
    args: [
      {
        tokenIn: order.tokenIn,
        tokenOut: order.tokenOut,
        amount: order.amount,
        fee,
        sqrtPriceLimitX96: 0n,
      },
    ],
  });
  return amountIn > 0n ? { venue: { kind: "v3", fee }, amount: amountIn } : null;
}

/** Uniswap v2 takes a 0.30% fee. Empty reserves and impossible outputs are skipped. */
export function v2AmountOut(
  amountIn: bigint,
  reserveIn: bigint,
  reserveOut: bigint,
): bigint | null {
  if (amountIn <= 0n || reserveIn <= 0n || reserveOut <= 0n) return null;
  const amountInWithFee = amountIn * 997n;
  const amountOut = (amountInWithFee * reserveOut) / (reserveIn * 1000n + amountInWithFee);
  return amountOut > 0n ? amountOut : null;
}

export function v2AmountIn(
  amountOut: bigint,
  reserveIn: bigint,
  reserveOut: bigint,
): bigint | null {
  if (amountOut <= 0n || reserveIn <= 0n || reserveOut <= 0n || amountOut >= reserveOut) {
    return null;
  }
  const numerator = reserveIn * amountOut * 1000n;
  const denominator = (reserveOut - amountOut) * 997n;
  return numerator / denominator + 1n;
}

async function quoteV2(
  client: PublicClient,
  order: PlannedStockOrder,
): Promise<CandidateQuote | null> {
  const pair = await client.readContract({
    address: V2_FACTORY,
    abi: v2FactoryAbi,
    functionName: "getPair",
    args: [order.tokenIn, order.tokenOut],
  });
  if (getAddress(pair) === zeroAddress) return null;
  const pairAddress = getAddress(pair);
  const [token0, reserves] = await Promise.all([
    client.readContract({
      address: pairAddress,
      abi: v2PairAbi,
      functionName: "token0",
    }),
    client.readContract({
      address: pairAddress,
      abi: v2PairAbi,
      functionName: "getReserves",
    }),
  ]);
  const reserve0 = reserves[0];
  const reserve1 = reserves[1];
  const tokenInIs0 = getAddress(token0) === order.tokenIn;
  const tokenOutIs0 = getAddress(token0) === order.tokenOut;
  if (!tokenInIs0 && !tokenOutIs0) return null;
  const reserveIn = tokenInIs0 ? reserve0 : reserve1;
  const reserveOut = tokenInIs0 ? reserve1 : reserve0;
  if (reserveIn <= 0n || reserveOut <= 0n) return null;
  const amount =
    order.direction === "exactIn"
      ? v2AmountOut(order.amount, reserveIn, reserveOut)
      : v2AmountIn(order.amount, reserveIn, reserveOut);
  return amount === null ? null : { venue: { kind: "v2" }, amount };
}

async function readCandidate(
  run: () => Promise<CandidateQuote | null>,
  report: { checks: number; transport: unknown },
): Promise<CandidateQuote | null> {
  try {
    const quote = await run();
    report.checks += 1;
    return quote;
  } catch (error) {
    if (isQuoteMiss(error)) {
      report.checks += 1;
      return null;
    }
    report.transport = error;
    return null;
  }
}

export async function quoteStockOrder(
  client: PublicClient,
  order: PlannedStockOrder,
): Promise<ProtectedStockQuote | null> {
  const report = { checks: 0, transport: null as unknown };
  const reads = await Promise.all([
    ...V3_FEE_TIERS.map((fee) => readCandidate(() => quoteV3(client, order, fee), report)),
    readCandidate(() => quoteV2(client, order), report),
  ]);
  if (report.checks === 0 && report.transport) {
    console.error("[stocks] uniswap quote unreachable", report.transport);
    throw new Error("Robinhood Chain is not reachable. Refresh and try again.");
  }
  const chosen = chooseProtectedQuote(
    reads.filter((quote): quote is CandidateQuote => quote !== null),
    order.direction,
  );
  if (!chosen) return null;
  const sellAmount = order.direction === "exactIn" ? order.amount : chosen.protected;
  return {
    ...order,
    quoted: chosen.quoted,
    protected: chosen.protected,
    venue: chosen.venue,
    sellToken: order.tokenIn,
    sellAmount,
  };
}

/** USD per token from an exact-in of USDG. Integer division, then a display number. */
export function usdPriceFromExactIn(
  usdgIn: bigint,
  tokenOut: bigint,
  decimals: number,
): number | null {
  if (usdgIn <= 0n || tokenOut <= 0n || decimals < 0) return null;
  const priceScaled = (usdgIn * 10n ** BigInt(decimals)) / tokenOut;
  if (priceScaled <= 0n) return null;
  const price = Number(priceScaled) / 1_000_000;
  return Number.isFinite(price) && price > 0 ? price : null;
}

/** Screen price from a small USDG exact-in. Returns null when no pool can fill the probe. */
export async function quoteTokenUsdPrice(
  client: PublicClient,
  token: Address,
  decimals: number,
): Promise<number | null> {
  const asset = getAddress(token);
  const probes = [10_000n, 1_000n, 100n];
  for (const usdgIn of probes) {
    const quote = await quoteStockOrder(client, {
      direction: "exactIn",
      tokenIn: USDG,
      tokenOut: asset,
      amount: usdgIn,
    });
    const price = quote ? usdPriceFromExactIn(usdgIn, quote.quoted, decimals) : null;
    if (price !== null) return price;
  }
  return null;
}
