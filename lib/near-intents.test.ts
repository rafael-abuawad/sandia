import { describe, expect, it } from "vitest";
import {
  assertUsableQuote,
  buildQuoteBody,
  destinationHashes,
  findStellarUsdc,
  toPayRoutes,
  type OneClickQuote,
} from "./near-intents";
import { STELLAR_USDC } from "./stellar/constants";

const tokens = [
  { assetId: "a", decimals: 6, blockchain: "base", symbol: "USDC" },
  { assetId: "b", decimals: 18, blockchain: "eth", symbol: "ETH" },
  { assetId: "c", decimals: 18, blockchain: "base", symbol: "SHIB" },
  {
    assetId: "d",
    decimals: 7,
    blockchain: "stellar",
    symbol: "USDC",
    contractAddress: STELLAR_USDC.issuer,
  },
  { assetId: "e", decimals: 7, blockchain: "stellar", symbol: "USDC", contractAddress: "GFAKE" },
  { assetId: "f", decimals: 6, blockchain: "hood", symbol: "USDG" },
];

describe("toPayRoutes", () => {
  it("keeps supported networks and tokens, in order", () => {
    expect(toPayRoutes(tokens).map((route) => route.assetId)).toEqual(["b", "a"]);
  });
});

describe("findStellarUsdc", () => {
  it("only trusts Circle's issuer", () => {
    expect(findStellarUsdc(tokens)?.assetId).toBe("d");
    expect(findStellarUsdc(tokens.filter((token) => token.assetId !== "d"))).toBeNull();
  });
});

describe("buildQuoteBody", () => {
  it("asks for the exact output, with refunds on the origin chain", () => {
    const body = buildQuoteBody({
      originAsset: "a",
      destinationAsset: "d",
      amountStroops: "10000000",
      recipient: "G",
      refundTo: "0x1",
      deadline: Date.parse("2026-11-06T12:00:00Z"),
    });
    expect(body).toMatchObject({
      dry: false,
      swapType: "EXACT_OUTPUT",
      amount: "10000000",
      depositType: "ORIGIN_CHAIN",
      refundType: "ORIGIN_CHAIN",
      recipientType: "DESTINATION_CHAIN",
      deadline: "2026-11-06T12:00:00.000Z",
    });
  });
});

describe("assertUsableQuote", () => {
  const quote = (minAmountOut: string, depositAddress?: string): OneClickQuote => ({
    quote: {
      depositAddress,
      amountIn: "1",
      minAmountIn: "1",
      amountOut: minAmountOut,
      minAmountOut,
      timeEstimate: 50,
    },
  });

  it("requires a deposit address and the full output", () => {
    expect(() => assertUsableQuote(quote("100", "0xabc"), "100")).not.toThrow();
    expect(() => assertUsableQuote(quote("99", "0xabc"), "100")).toThrow();
    expect(() => assertUsableQuote(quote("100"), "100")).toThrow();
  });
});

describe("destinationHashes", () => {
  it("keeps valid hashes, lowercased", () => {
    expect(
      destinationHashes({
        swapDetails: {
          destinationChainTxHashes: [{ hash: "A".repeat(64) }, { hash: "0xnope" }, {}],
        },
      }),
    ).toEqual(["a".repeat(64)]);
    expect(destinationHashes({})).toEqual([]);
  });
});
