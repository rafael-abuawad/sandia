import { describe, expect, it } from "vitest";
import { aggregateExposure, formatNetApy, parseMorphoVaultSnapshot } from "./morpho-vault";

describe("formatNetApy", () => {
  it("renders Morpho's decimal avgNetApy as a percent", () => {
    expect(formatNetApy(0.0361)).toBe("3.61%");
  });

  it("renders a dash when the rate is missing", () => {
    expect(formatNetApy(null)).toBe("—");
    expect(formatNetApy(Number.NaN)).toBe("—");
  });
});

describe("aggregateExposure", () => {
  it("collapses the same collateral and sorts by USD", () => {
    const rows = aggregateExposure([
      { symbol: "spUSDG", usd: 13.21, logoUrl: null },
      { symbol: "USDe", usd: 100, logoUrl: "https://example.com/usde.svg" },
      { symbol: "USDe", usd: 227.72, logoUrl: null },
      { symbol: "WETH", usd: 0.38, logoUrl: null },
      { symbol: null, usd: 50 },
      { symbol: "mGLO", usd: 0 },
    ]);

    expect(rows.map((row) => row.symbol)).toEqual(["USDe", "spUSDG", "WETH"]);
    expect(rows[0]?.usd).toBeCloseTo(327.72);
    expect(rows[0]?.logoUrl).toBe("https://example.com/usde.svg");
  });
});

describe("parseMorphoVaultSnapshot", () => {
  it("reads net APY and adapter collateral from a Vault V2 payload", () => {
    const parsed = parseMorphoVaultSnapshot({
      data: {
        vaultV2ByAddress: {
          avgNetApy: 0.0361,
          totalAssetsUsd: 479_899_124.74,
          liquidityUsd: 56_647_708.47,
          adapters: {
            items: [
              {
                positions: {
                  items: [
                    {
                      state: { supplyAssetsUsd: 124.12e6 },
                      market: { collateralAsset: { symbol: "syrupUSDG", logoURI: null } },
                    },
                    {
                      state: { supplyAssetsUsd: 327.72e6 },
                      market: {
                        collateralAsset: {
                          symbol: "USDe",
                          logoURI: "https://cdn.example/usde.png",
                        },
                      },
                    },
                  ],
                },
              },
              { positions: null },
            ],
          },
        },
      },
    });

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(formatNetApy(parsed.snapshot.netApy)).toBe("3.61%");
    expect(parsed.snapshot.exposure.map((row) => row.symbol)).toEqual(["USDe", "syrupUSDG"]);
  });
});
