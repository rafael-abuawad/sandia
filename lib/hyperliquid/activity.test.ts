import { describe, expect, it } from "vitest";
import {
  ACTIVITY_PAGE_SIZE,
  buildHlActivity,
  mergeActivityItems,
  nextActivityCursor,
  sourcesToLoad,
  visibleActivity,
} from "./activity";

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

describe("activity pagination", () => {
  it("hides rows older than a source that still has pages", () => {
    const visible = visibleActivity([
      {
        items: [
          { time: 100, id: "new-request" },
          { time: 40, id: "old-request" },
        ],
        hasMore: true,
      },
      {
        items: [
          { time: 90, id: "trade" },
          { time: 10, id: "old-trade" },
        ],
        hasMore: true,
      },
    ]);
    expect(visible.map((item) => item.id)).toEqual(["new-request", "trade", "old-request"]);
  });

  it("shows everything once every source is exhausted", () => {
    const visible = visibleActivity([
      { items: [{ time: 5, id: "request" }], hasMore: false },
      { items: [{ time: 9, id: "trade" }], hasMore: false },
    ]);
    expect(visible.map((item) => item.id)).toEqual(["trade", "request"]);
  });

  it("waits until a source that is still loading its first page", () => {
    expect(
      visibleActivity([
        { items: [{ time: 5, id: "request" }], hasMore: false },
        { items: [], hasMore: true },
      ]),
    ).toEqual([]);
  });

  it("loads only the source sitting on the frontier", () => {
    expect(
      sourcesToLoad([
        { oldest: 80, hasMore: true },
        { oldest: 20, hasMore: true },
      ]),
    ).toEqual([true, false]);
    expect(
      sourcesToLoad([
        { oldest: null, hasMore: false },
        { oldest: 20, hasMore: true },
      ]),
    ).toEqual([false, true]);
  });

  it("keeps scanning a short window and stops when a fill page is capped", () => {
    expect(
      nextActivityCursor({
        startTime: 50,
        floor: 0,
        itemCount: 3,
        pageSize: ACTIVITY_PAGE_SIZE,
        fillsCapped: false,
        oldestFillTime: null,
      }),
    ).toEqual({ nextEndTime: 49, continueScan: true });

    expect(
      nextActivityCursor({
        startTime: 50,
        floor: 0,
        itemCount: 3,
        pageSize: ACTIVITY_PAGE_SIZE,
        fillsCapped: true,
        oldestFillTime: 80,
      }),
    ).toEqual({ nextEndTime: 79, continueScan: false });
  });

  it("stops at the lookback floor", () => {
    expect(
      nextActivityCursor({
        startTime: 10,
        floor: 10,
        itemCount: 1,
        pageSize: ACTIVITY_PAGE_SIZE,
        fillsCapped: false,
        oldestFillTime: null,
      }),
    ).toEqual({ nextEndTime: null, continueScan: false });
  });

  it("drops duplicate rows when pages overlap", () => {
    const merged = mergeActivityItems([
      [
        {
          id: "fill-1",
          kind: "trade",
          title: "Buy BTC",
          detail: "1",
          amountUsd: null,
          time: 2,
        },
      ],
      [
        {
          id: "fill-1",
          kind: "trade",
          title: "Buy BTC",
          detail: "1",
          amountUsd: null,
          time: 2,
        },
        {
          id: "ledger-1",
          kind: "deposit",
          title: "Deposit",
          detail: "USDC arrived",
          amountUsd: 5,
          time: 1,
        },
      ],
    ]);
    expect(merged.map((item) => item.id)).toEqual(["fill-1", "ledger-1"]);
  });
});
