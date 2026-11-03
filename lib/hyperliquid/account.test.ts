import { describe, expect, it } from "vitest";
import { summarizeAccount } from "./account";
import type { HlClearinghouseState } from "./info";

function perp(
  accountValue: string,
  withdrawable: string,
  positions: Array<[string, string, string]> = [],
): HlClearinghouseState {
  return {
    marginSummary: { accountValue, totalNtlPos: "0", totalMarginUsed: "0" },
    withdrawable,
    assetPositions: positions.map(([coin, szi, pnl]) => ({
      position: {
        coin,
        szi,
        entryPx: "100",
        positionValue: String(Math.abs(Number(szi)) * 100),
        unrealizedPnl: pnl,
        returnOnEquity: "0.1",
        liquidationPx: "80",
        marginUsed: "20",
        leverage: { type: "cross", value: 5 },
      },
    })),
  };
}

describe("summarizeAccount", () => {
  it("adds each dex's account value for standard accounts", () => {
    const summary = summarizeAccount({
      mode: "default",
      perps: [
        perp("120", "90", [["BTC", "0.5", "10"]]),
        perp("30", "30", [["xyz:TSLA", "-1", "-2"]]),
      ],
      spot: { balances: [{ coin: "USDC", total: "5", hold: "0" }] },
    });
    expect(summary.equity).toBe(155);
    expect(summary.available).toBe(90);
    expect(summary.unrealizedPnl).toBe(8);
    expect(summary.positions.map((p) => [p.coin, p.side])).toEqual([
      ["xyz:TSLA", "short"],
      ["BTC", "long"],
    ]);
  });

  it("reads collateral from the spot ledger for unified accounts", () => {
    const summary = summarizeAccount({
      mode: "unifiedAccount",
      perps: [perp("0", "0", [["ETH", "1", "15"]]), perp("0", "0")],
      spot: { balances: [{ coin: "USDC", total: "200", hold: "40" }] },
    });
    expect(summary.unified).toBe(true);
    expect(summary.equity).toBe(215);
    expect(summary.available).toBe(160);
  });

  it("ignores closed positions", () => {
    const summary = summarizeAccount({
      mode: "disabled",
      perps: [perp("10", "10", [["SOL", "0", "0"]])],
      spot: { balances: [] },
    });
    expect(summary.positions).toEqual([]);
  });
});
