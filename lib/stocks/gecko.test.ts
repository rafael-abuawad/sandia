import { describe, expect, it } from "vitest";
import { parseGeckoTokenStats } from "./gecko";

const ETH = "0x0bd7d308f8e1639fab988df18a8011f41eacad73";
const HOOD = "0x274c8c4665c0343730c78b184e560f902a8bf200";

describe("parseGeckoTokenStats", () => {
  it("reads a USD price and a 24h volume, including zero", () => {
    const stats = parseGeckoTokenStats({
      data: [
        {
          attributes: {
            address: ETH,
            price_usd: "2671.1",
            volume_usd: { h24: "959517928.939844" },
          },
        },
        {
          attributes: {
            address: HOOD,
            price_usd: "145.1492938768",
            volume_usd: { h24: "0.0" },
          },
        },
      ],
    });

    expect(stats).toEqual([
      { address: ETH, priceUsd: 2671.1, volumeUsd24h: 959517928.939844 },
      { address: HOOD, priceUsd: 145.1492938768, volumeUsd24h: 0 },
    ]);
  });

  it("drops a missing address and a non-positive price", () => {
    const stats = parseGeckoTokenStats({
      data: [
        { attributes: { price_usd: "10", volume_usd: { h24: "5" } } },
        { attributes: { address: ETH, price_usd: "0", volume_usd: { h24: "-1" } } },
        "nope",
      ],
    });

    expect(stats).toEqual([{ address: ETH, priceUsd: null, volumeUsd24h: null }]);
  });

  it("returns nothing for an unexpected payload", () => {
    expect(parseGeckoTokenStats(null)).toEqual([]);
    expect(parseGeckoTokenStats({ data: {} })).toEqual([]);
  });
});
