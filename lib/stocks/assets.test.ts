import { getAddress } from "viem";
import { describe, expect, it } from "vitest";
import { ROBINHOOD_WETH } from "@/lib/destination";
import type { StockToken } from "@/lib/rhj/client";
import {
  ETH_STOCK,
  HOOD_STOCK,
  LISTED_CHAIN_STOCKS,
  resolveStockAsset,
  stockQuantityLabel,
} from "./assets";

const OTHER_HOOD: StockToken = {
  id: "other-hood",
  symbol: "HOOD",
  name: "Some other HOOD",
  shortName: "Some other HOOD",
  contractAddress: "0x3333333333333333333333333333333333333333",
  chainId: 1,
  logoUrl: null,
  currentMultiplier: "1",
  status: "ASSET_STATUS_ACTIVE",
  tokenDecimals: 18,
};

const SPY: StockToken = {
  id: "spy",
  symbol: "SPY",
  name: "SPDR S&P 500 • Robinhood Token",
  shortName: "SPDR S&P 500",
  contractAddress: "0x4444444444444444444444444444444444444444",
  chainId: 4663,
  logoUrl: null,
  currentMultiplier: "1",
  status: "ASSET_STATUS_ACTIVE",
  tokenDecimals: 18,
};

describe("resolveStockAsset", () => {
  it("resolves ETH to wrapped ETH on Robinhood Chain", () => {
    const eth = resolveStockAsset("eth", [OTHER_HOOD, SPY]);
    expect(eth?.contractAddress).toBe(getAddress(ROBINHOOD_WETH));
    expect(eth?.tokenDecimals).toBe(18);
    expect(eth).toBe(ETH_STOCK);
  });

  it("resolves HOOD to the Robinhood Markets token and ignores every other HOOD", () => {
    const hood = resolveStockAsset("HOOD", [OTHER_HOOD, SPY]);
    expect(hood?.contractAddress).toBe(getAddress("0x274c8c4665c0343730c78b184e560f902a8bf200"));
    expect(hood?.name).toBe("Robinhood Markets Inc. Class A Common Stock");
    expect(hood?.logoUrl).toBe("/assets/chains/robinhood.svg");
    expect(hood?.tokenDecimals).toBe(18);
    expect(hood).toBe(HOOD_STOCK);
    expect(hood?.contractAddress).not.toBe(OTHER_HOOD.contractAddress);
  });

  it("resolves RHJ symbols from the catalog", () => {
    expect(resolveStockAsset("spy", [SPY, OTHER_HOOD])).toBe(SPY);
    expect(resolveStockAsset("AAPL", [SPY])).toBeNull();
    expect(stockQuantityLabel("SPY")).toBe("shares");
    expect(stockQuantityLabel("ETH")).toBe("tokens");
    expect(stockQuantityLabel("HOOD")).toBe("tokens");
    expect(LISTED_CHAIN_STOCKS.map((asset) => asset.symbol)).toEqual(["ETH"]);
  });
});
