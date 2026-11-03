import { describe, expect, it } from "vitest";
import type { PositionView } from "./account";
import { allocation, parsePortfolio, rangePnl } from "./portfolio";

function position(coin: string, marginUsed: number, unrealizedPnl: number): PositionView {
  return {
    coin,
    side: "long",
    size: 1,
    entryPx: 1,
    positionValue: 1,
    unrealizedPnl,
    returnOnEquity: 0,
    liquidationPx: null,
    marginUsed,
    leverage: 5,
    marginType: "cross",
  };
}

describe("parsePortfolio", () => {
  it("reads each range and fills missing ones with empty series", () => {
    const history = parsePortfolio([
      [
        "day",
        {
          accountValueHistory: [
            [1, "100"],
            [2, "110.5"],
          ],
          pnlHistory: [
            [1, "0"],
            [2, "10.5"],
          ],
          vlm: "2500",
        },
      ],
    ]);
    expect(history.day.value).toEqual([
      { t: 1, c: 100 },
      { t: 2, c: 110.5 },
    ]);
    expect(rangePnl(history.day.pnl)).toBe(10.5);
    expect(history.day.volume).toBe(2500);
    expect(history.week).toEqual({ value: [], pnl: [], volume: 0 });
    expect(rangePnl(history.week.pnl)).toBe(0);
  });
});

describe("allocation", () => {
  it("splits cash and position equity by share, largest first", () => {
    const slices = allocation(50, [position("BTC", 30, 10), position("xyz:TSLA", 15, -5)]);
    expect(slices.map((slice) => [slice.label, slice.value])).toEqual([
      ["Cash", 50],
      ["BTC", 40],
      ["TSLA", 10],
    ]);
    expect(slices.reduce((sum, slice) => sum + slice.share, 0)).toBeCloseTo(1);
  });

  it("is empty for an unfunded account", () => {
    expect(allocation(0, [])).toEqual([]);
  });
});
