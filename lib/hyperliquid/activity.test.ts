import { describe, expect, it } from "vitest";
import { buildHlActivity } from "./activity";

const ME = "0x00000000000000000000000000000000000000aa";
const THEM = "0x00000000000000000000000000000000000000bb";

describe("buildHlActivity", () => {
  it("lists fills, deposits, and transfers newest first", () => {
    const items = buildHlActivity(
      ME,
      [
        {
          coin: "xyz:TSLA",
          px: "400",
          sz: "1",
          side: "B",
          time: 3,
          dir: "Open Long",
          closedPnl: "0",
          fee: "0.2",
          hash: "0x1",
          oid: 1,
        },
      ],
      [
        { time: 1, hash: "0x2", delta: { type: "deposit", usdc: "50" } },
        {
          time: 2,
          hash: "0x3",
          delta: {
            type: "send",
            user: ME,
            destination: THEM,
            token: "USDC",
            amount: "10",
            usdcValue: "10",
          },
        },
        {
          time: 4,
          hash: "0x4",
          delta: {
            type: "send",
            user: THEM,
            destination: ME,
            token: "USDC",
            amount: "5",
            usdcValue: "5",
          },
        },
      ],
    );
    expect(items.map((item) => [item.kind, item.amountUsd])).toEqual([
      ["received", 5],
      ["trade", null],
      ["sent", -10],
      ["deposit", 50],
    ]);
    expect(items[1].title).toBe("Open Long TSLA");
  });

  it("skips transfers between your own balances and non-USDC tokens", () => {
    const items = buildHlActivity(
      ME,
      [],
      [
        {
          time: 1,
          hash: "0x5",
          delta: { type: "send", user: ME, destination: ME, token: "USDC", amount: "10" },
        },
        {
          time: 2,
          hash: "0x6",
          delta: { type: "spotTransfer", user: THEM, destination: ME, token: "HYPE", amount: "1" },
        },
      ],
    );
    expect(items).toEqual([]);
  });
});
