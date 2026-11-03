import { describe, expect, it } from "vitest";
import { builderFeePercent, builderFeeRate, HL_REFERRAL_CODE, orderBuilder } from "./config";
import {
  closeLimitPx,
  defaultLeverage,
  estimateLiquidationPx,
  leverageSteps,
  quoteTicket,
} from "./math";

describe("builder fee", () => {
  it("converts tenths of a basis point to percent and rate", () => {
    expect(builderFeePercent(50)).toBe("0.05%");
    expect(builderFeePercent(100)).toBe("0.1%");
    expect(builderFeeRate(50)).toBeCloseTo(0.0005);
  });

  it("charges no builder fee and sends no builder field until an address is configured", () => {
    expect(builderFeeRate()).toBe(0);
    expect(orderBuilder()).toEqual({});
  });

  it("refers new accounts with Sandia's code", () => {
    expect(HL_REFERRAL_CODE).toBe("BOLIVIA");
  });
});

describe("leverage", () => {
  it("offers presets up to the market cap", () => {
    expect(leverageSteps(20)).toEqual([1, 2, 3, 5, 10, 20]);
    expect(leverageSteps(3)).toEqual([1, 2, 3]);
    expect(leverageSteps(40)).toEqual([1, 2, 3, 5, 10, 20, 25, 40]);
    expect(leverageSteps(7)).toEqual([1, 2, 3, 5, 7]);
  });

  it("defaults to 5x or the cap", () => {
    expect(defaultLeverage(50)).toBe(5);
    expect(defaultLeverage(3)).toBe(3);
  });
});

describe("quoteTicket", () => {
  it("sizes a long from margin and leverage and protects the price", () => {
    const quote = quoteTicket({
      side: "long",
      marginUsd: 100,
      leverage: 5,
      markPx: 400,
      szDecimals: 3,
      maxLeverage: 20,
    });
    expect(quote?.size).toBe("1.25");
    expect(quote?.notional).toBeCloseTo(500);
    expect(quote?.limitPx).toBe("404");
    expect(quote?.builderFee).toBe(0);
    expect(quote?.fee).toBeCloseTo(500 * 0.00045);
  });

  it("truncates size to lot size and prices shorts below the mark", () => {
    const quote = quoteTicket({
      side: "short",
      marginUsd: 10,
      leverage: 3,
      markPx: 97_123.5,
      szDecimals: 5,
      maxLeverage: 40,
    });
    expect(quote?.size).toBe("0.0003");
    expect(Number(quote?.limitPx)).toBeLessThan(97_123.5);
  });

  it("returns null when the order would round to zero", () => {
    expect(
      quoteTicket({
        side: "long",
        marginUsd: 1,
        leverage: 1,
        markPx: 100_000,
        szDecimals: 3,
        maxLeverage: 40,
      }),
    ).toBeNull();
    expect(
      quoteTicket({
        side: "long",
        marginUsd: 0,
        leverage: 5,
        markPx: 10,
        szDecimals: 2,
        maxLeverage: 10,
      }),
    ).toBeNull();
  });
});

describe("estimateLiquidationPx", () => {
  it("puts a long's liquidation below entry and a short's above", () => {
    const long = estimateLiquidationPx({
      side: "long",
      entryPx: 100,
      leverage: 10,
      maxLeverage: 20,
    });
    const short = estimateLiquidationPx({
      side: "short",
      entryPx: 100,
      leverage: 10,
      maxLeverage: 20,
    });
    expect(long).toBeCloseTo(92.3077, 3);
    expect(short).toBeCloseTo(107.3171, 3);
  });

  it("has no liquidation price for a fully collateralized long", () => {
    expect(
      estimateLiquidationPx({ side: "long", entryPx: 100, leverage: 1, maxLeverage: 1 }),
    ).toBeNull();
  });
});

describe("closeLimitPx", () => {
  it("sells a long below mark and buys back a short above it", () => {
    expect(Number(closeLimitPx({ positionSize: 2, markPx: 100, szDecimals: 2 }))).toBe(99);
    expect(Number(closeLimitPx({ positionSize: -2, markPx: 100, szDecimals: 2 }))).toBe(101);
  });
});
