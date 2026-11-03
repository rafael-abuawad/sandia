import { describe, expect, it } from "vitest";
import { filterMarkets, hip3AssetId, marketHref, normalizeMarkets } from "./markets";

const ctx = (markPx: string, prevDayPx: string) => ({
  funding: "0.0000125",
  openInterest: "10",
  prevDayPx,
  dayNtlVlm: "1000",
  markPx,
  oraclePx: markPx,
});

describe("normalizeMarkets", () => {
  it("keeps validator perp asset ids as indexes and drops delisted markets", () => {
    const markets = normalizeMarkets({
      dex: "",
      dexIndex: 0,
      universe: [
        { name: "BTC", szDecimals: 5, maxLeverage: 40 },
        { name: "OLD", szDecimals: 0, maxLeverage: 3, isDelisted: true },
        { name: "ETH", szDecimals: 4, maxLeverage: 25, marginMode: "strictIsolated" },
      ],
      ctxs: [ctx("100", "80"), ctx("1", "1"), ctx("10", "10")],
    });
    expect(markets.map((m) => [m.coin, m.assetId, m.group])).toEqual([
      ["BTC", 0, "crypto"],
      ["ETH", 2, "crypto"],
    ]);
    expect(markets[0].change24h).toBeCloseTo(0.25);
    expect(markets[1].isolatedOnly).toBe(true);
  });

  it("gives HIP-3 markets offset asset ids and groups them by category", () => {
    const markets = normalizeMarkets({
      dex: "xyz",
      dexIndex: 1,
      universe: [
        { name: "xyz:TSLA", szDecimals: 3, maxLeverage: 20 },
        { name: "xyz:GOLD", szDecimals: 4, maxLeverage: 20 },
      ],
      ctxs: [ctx("400", "390"), ctx("2400", "2400")],
      annotations: new Map([
        ["xyz:TSLA", { category: "stocks", displayName: "TSLA", keywords: ["tesla"] }],
        ["xyz:GOLD", { category: "commodities" }],
      ]),
    });
    expect(markets.map((m) => [m.symbol, m.assetId, m.group, m.name])).toEqual([
      ["TSLA", 110000, "stocks", "Tesla"],
      ["GOLD", 110001, "macro", "GOLD"],
    ]);
    expect(hip3AssetId(2, 5)).toBe(120005);
  });
});

describe("filterMarkets", () => {
  const markets = normalizeMarkets({
    dex: "xyz",
    dexIndex: 1,
    universe: [{ name: "xyz:AAPL", szDecimals: 3, maxLeverage: 20 }],
    ctxs: [ctx("200", "200")],
    annotations: new Map([["xyz:AAPL", { category: "stocks", keywords: ["apple"] }]]),
  });

  it("filters by group, and search ignores the group", () => {
    expect(filterMarkets(markets, "crypto", "")).toHaveLength(0);
    expect(filterMarkets(markets, "stocks", "")).toHaveLength(1);
    expect(filterMarkets(markets, "crypto", "apple")).toHaveLength(1);
  });

  it("encodes HIP-3 coins in URLs", () => {
    expect(marketHref("xyz:AAPL")).toBe("/trade/xyz%3AAAPL");
  });
});
