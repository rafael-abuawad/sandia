import { describe, expect, it } from "vitest";
import { readTokenDecimals, toStockToken, type RhjAsset } from "./client";

const asset: RhjAsset = {
  id: "spy",
  tokenSymbol: "SPY",
  tokenName: "SPDR S&P 500 • Robinhood Token",
  deployments: [{ contractAddress: "0x1111111111111111111111111111111111111111", chainId: 4663 }],
  currentMultiplier: "1",
  pendingMultiplier: "",
  status: "ASSET_STATUS_ACTIVE",
  tokenDecimals: 18,
};

describe("toStockToken", () => {
  it("carries tokenDecimals from the RHJ asset", () => {
    expect(toStockToken(asset)?.tokenDecimals).toBe(18);
    expect(toStockToken({ ...asset, tokenDecimals: "18" })?.tokenDecimals).toBe(18);
  });

  it("drops an asset whose decimals cannot be traded", () => {
    expect(toStockToken({ ...asset, tokenDecimals: undefined })).toBeNull();
    expect(readTokenDecimals("18.5")).toBeNull();
    expect(readTokenDecimals(19)).toBeNull();
  });
});
