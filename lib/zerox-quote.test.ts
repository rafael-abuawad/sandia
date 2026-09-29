import { describe, expect, it } from "vitest";
import { ethSpendBaseUnits, parseEthSwapQuote } from "./zerox-quote";

const BUY = "100000000";
const TX = {
  to: "0x0000000000001fF3684f28c67538d4D072C22734",
  data: "0xabcdef",
  value: "25000000000000000",
  gas: "180000",
};

describe("parseEthSwapQuote", () => {
  it("keeps an exact-buy quote that delivers the requested USDG", () => {
    const quote = parseEthSwapQuote(
      {
        liquidityAvailable: true,
        buyAmount: BUY,
        maxSellAmount: "24000000000000000",
        transaction: TX,
      },
      BUY,
    );
    expect(quote.buyAmount).toBe(BUY);
    expect(quote.transaction.to).toBe(TX.to);
    expect(quote.transaction.gas).toBe("180000");
    expect(ethSpendBaseUnits(quote)).toBe(25_000_000_000_000_000n);
  });

  it("rejects a quote that would deliver a different USDG amount", () => {
    expect(() =>
      parseEthSwapQuote(
        {
          liquidityAvailable: true,
          buyAmount: "1",
          maxSellAmount: "1",
          transaction: TX,
        },
        BUY,
      ),
    ).toThrow(/requested USDG amount/);
  });

  it("rejects a quote with no liquidity or no transaction value", () => {
    expect(() => parseEthSwapQuote({ liquidityAvailable: false }, BUY)).toThrow(/No route/);
    expect(() =>
      parseEthSwapQuote(
        {
          liquidityAvailable: true,
          buyAmount: BUY,
          maxSellAmount: "1",
          transaction: { ...TX, value: "0" },
        },
        BUY,
      ),
    ).toThrow(/No route/);
  });
});
