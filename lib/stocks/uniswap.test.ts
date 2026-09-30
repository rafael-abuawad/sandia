import { decodeFunctionData, erc20Abi, getAddress, type Hex } from "viem";
import { describe, expect, it } from "vitest";
import { ROBINHOOD_USDG, ROBINHOOD_WETH } from "@/lib/destination";
import {
  SWAP_ROUTER_02,
  amountInMaximum,
  amountOutMinimum,
  buildStockApprove,
  buildStockSwap,
  chooseProtectedQuote,
  planStockOrder,
  quoteLegs,
  requireSwapRouterCall,
  swapRouterAbi,
  usdPriceFromExactIn,
  type ProtectedStockQuote,
} from "./uniswap";

const TOKEN = getAddress("0x1111111111111111111111111111111111111111");
const WALLET = getAddress("0x2222222222222222222222222222222222222222");
const USDG = getAddress(ROBINHOOD_USDG.address);
const V2_ROUTER = getAddress("0x89e5db8b5aa49aa85ac63f691524311aeb649eba");
const NOW = 1_800_000_000n;

function innerSwap(data: Hex) {
  const outer = decodeFunctionData({ abi: swapRouterAbi, data });
  if (outer.functionName !== "multicall") throw new Error("expected multicall");
  const deadline = outer.args[0];
  const calls = outer.args[1];
  const innerData = calls[0];
  if (!innerData) throw new Error("missing inner swap");
  const inner = decodeFunctionData({ abi: swapRouterAbi, data: innerData });
  return { deadline, innerData, inner };
}

describe("chooseProtectedQuote", () => {
  it("keeps the v3 fee tier or v2 pool with the best exact-in output", () => {
    const chosen = chooseProtectedQuote(
      [
        { venue: { kind: "v3", fee: 500 }, amount: 100n },
        { venue: { kind: "v3", fee: 3000 }, amount: 250n },
        { venue: { kind: "v2" }, amount: 180n },
      ],
      "exactIn",
    );
    expect(chosen).toEqual({
      venue: { kind: "v3", fee: 3000 },
      quoted: 250n,
      protected: 247n,
    });
  });

  it("skips an empty tier and a reverted tier that was left out", () => {
    const chosen = chooseProtectedQuote(
      [
        { venue: { kind: "v3", fee: 500 }, amount: 0n },
        { venue: { kind: "v2" }, amount: 140n },
      ],
      "exactIn",
    );
    expect(chosen?.venue).toEqual({ kind: "v2" });
    expect(chosen?.quoted).toBe(140n);
  });

  it("picks the pool that charges the least input on an exact-out order", () => {
    const chosen = chooseProtectedQuote(
      [
        { venue: { kind: "v3", fee: 500 }, amount: 500n },
        { venue: { kind: "v3", fee: 3000 }, amount: 120n },
        { venue: { kind: "v2" }, amount: 80n },
      ],
      "exactOut",
    );
    expect(chosen).toEqual({
      venue: { kind: "v2" },
      quoted: 80n,
      protected: 81n,
    });
  });

  it("returns null when every pool is empty", () => {
    expect(
      chooseProtectedQuote([{ venue: { kind: "v3", fee: 500 }, amount: 0n }], "exactIn"),
    ).toBeNull();
  });
});

describe("usdPriceFromExactIn", () => {
  it("prices one token from the USDG spent and the tokens received", () => {
    expect(usdPriceFromExactIn(1_000_000n, 500_000_000_000_000_000n, 18)).toBe(2);
    expect(usdPriceFromExactIn(10_000n, 3_333_333_333_333n, 18)).toBeCloseTo(3000, 0);
  });
});

describe("slippage rounding", () => {
  it("floors the exact-in minimum and ceils the exact-out maximum by 1%", () => {
    expect(amountOutMinimum(10_001n)).toBe(9_900n);
    expect(amountOutMinimum(199n)).toBe(197n);
    expect(amountOutMinimum(100n)).toBe(99n);
    expect(amountOutMinimum(1n)).toBeNull();
    expect(amountInMaximum(10_001n)).toBe(10_102n);
    expect(amountInMaximum(100n)).toBe(101n);
    expect(amountInMaximum(1n)).toBe(2n);
  });
});

describe("planStockOrder", () => {
  it("maps buy and sell amounts onto exact-in and exact-out against USDG", () => {
    expect(planStockOrder({ side: "buy", unit: "usd", token: TOKEN, amount: 5n })).toEqual({
      direction: "exactIn",
      tokenIn: USDG,
      tokenOut: TOKEN,
      amount: 5n,
    });
    expect(planStockOrder({ side: "sell", unit: "usd", token: TOKEN, amount: 5n })).toEqual({
      direction: "exactOut",
      tokenIn: TOKEN,
      tokenOut: USDG,
      amount: 5n,
    });
    expect(planStockOrder({ side: "buy", unit: "shares", token: TOKEN, amount: 5n })).toEqual({
      direction: "exactOut",
      tokenIn: USDG,
      tokenOut: TOKEN,
      amount: 5n,
    });
    expect(planStockOrder({ side: "sell", unit: "shares", token: TOKEN, amount: 5n })).toEqual({
      direction: "exactIn",
      tokenIn: TOKEN,
      tokenOut: USDG,
      amount: 5n,
    });
  });
});

describe("buildStockSwap", () => {
  const base = {
    tokenIn: USDG,
    tokenOut: TOKEN,
    amount: 1_000_000n,
    quoted: 100n,
    recipient: WALLET,
    nowSeconds: NOW,
  };

  it("wraps each route in a two-minute SwapRouter02 multicall", () => {
    const exactInV3 = buildStockSwap({
      ...base,
      direction: "exactIn",
      venue: { kind: "v3", fee: 500 },
    });
    expect(exactInV3.to).toBe(SWAP_ROUTER_02);
    expect(exactInV3.value).toBe(0n);
    const v3In = innerSwap(exactInV3.data);
    expect(v3In.deadline).toBe(NOW + 120n);
    expect(v3In.innerData.startsWith("0x04e45aaf")).toBe(true);
    expect(v3In.inner.functionName).toBe("exactInputSingle");
    expect(v3In.inner.args[0]).toMatchObject({
      tokenIn: USDG,
      tokenOut: TOKEN,
      fee: 500,
      recipient: WALLET,
      amountIn: 1_000_000n,
      amountOutMinimum: 99n,
      sqrtPriceLimitX96: 0n,
    });

    const exactOutV3 = buildStockSwap({
      ...base,
      direction: "exactOut",
      tokenIn: TOKEN,
      tokenOut: USDG,
      venue: { kind: "v3", fee: 3000 },
      quoted: 100n,
    });
    const v3Out = innerSwap(exactOutV3.data);
    expect(v3Out.innerData.startsWith("0x5023b4df")).toBe(true);
    expect(v3Out.inner.functionName).toBe("exactOutputSingle");
    expect(v3Out.inner.args[0]).toMatchObject({
      fee: 3000,
      amountOut: 1_000_000n,
      amountInMaximum: 101n,
      sqrtPriceLimitX96: 0n,
    });

    const exactInV2 = buildStockSwap({
      ...base,
      direction: "exactIn",
      venue: { kind: "v2" },
    });
    const v2In = innerSwap(exactInV2.data);
    expect(v2In.innerData.startsWith("0x472b43f3")).toBe(true);
    expect(v2In.inner.functionName).toBe("swapExactTokensForTokens");
    expect(v2In.inner.args).toEqual([1_000_000n, 99n, [USDG, TOKEN], WALLET]);

    const exactOutV2 = buildStockSwap({
      ...base,
      direction: "exactOut",
      tokenIn: TOKEN,
      tokenOut: USDG,
      venue: { kind: "v2" },
      quoted: 100n,
    });
    const v2Out = innerSwap(exactOutV2.data);
    expect(v2Out.innerData.startsWith("0x42712a67")).toBe(true);
    expect(v2Out.inner.functionName).toBe("swapTokensForExactTokens");
    expect(v2Out.inner.args).toEqual([1_000_000n, 101n, [TOKEN, USDG], WALLET]);
  });

  it("rejects any transaction target other than SwapRouter02", () => {
    const swap = buildStockSwap({
      ...base,
      direction: "exactIn",
      venue: { kind: "v3", fee: 500 },
    });
    expect(requireSwapRouterCall(swap)).toEqual(swap);
    expect(() => requireSwapRouterCall({ ...swap, to: USDG })).toThrow(/SwapRouter02/);
    expect(() => requireSwapRouterCall({ ...swap, to: V2_ROUTER })).toThrow(/SwapRouter02/);
    expect(() => requireSwapRouterCall({ ...swap, to: getAddress(ROBINHOOD_WETH) })).toThrow(
      /SwapRouter02/,
    );
    expect(() => requireSwapRouterCall({ ...swap, value: 1n })).toThrow(/native ETH/);

    const approval = buildStockApprove(USDG, 1_000_000n);
    expect(approval.to).toBe(USDG);
    expect(approval.value).toBe(0n);
    const decoded = decodeFunctionData({ abi: erc20Abi, data: approval.data });
    expect(decoded.args).toEqual([SWAP_ROUTER_02, 1_000_000n]);
    expect(() => requireSwapRouterCall(approval)).toThrow(/SwapRouter02/);
  });
});

describe("quoteLegs", () => {
  function quote(
    partial: Partial<ProtectedStockQuote> &
      Pick<ProtectedStockQuote, "direction" | "tokenIn" | "tokenOut">,
  ): ProtectedStockQuote {
    return {
      amount: 1_000_000n,
      quoted: 50n,
      protected: 49n,
      venue: { kind: "v3", fee: 500 },
      sellToken: partial.tokenIn,
      sellAmount: 1_000_000n,
      ...partial,
    };
  }

  it("shows the USDG and token amounts from the quote", () => {
    expect(quoteLegs(quote({ direction: "exactIn", tokenIn: USDG, tokenOut: TOKEN }))).toEqual({
      usdgAmount: 1_000_000n,
      tokenAmount: 50n,
    });
    expect(quoteLegs(quote({ direction: "exactIn", tokenIn: TOKEN, tokenOut: USDG }))).toEqual({
      tokenAmount: 1_000_000n,
      usdgAmount: 50n,
    });
    expect(quoteLegs(quote({ direction: "exactOut", tokenIn: TOKEN, tokenOut: USDG }))).toEqual({
      usdgAmount: 1_000_000n,
      tokenAmount: 50n,
    });
    expect(quoteLegs(quote({ direction: "exactOut", tokenIn: USDG, tokenOut: TOKEN }))).toEqual({
      tokenAmount: 1_000_000n,
      usdgAmount: 50n,
    });
  });
});
