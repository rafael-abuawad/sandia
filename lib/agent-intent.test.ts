import { describe, expect, it } from "vitest";
import {
  extractExplicitAmount,
  extractStockUnit,
  resolveBatchRecipients,
  resolveNamedContact,
  resolveStock,
} from "./agent-intent";
import type { AgentStock } from "./agent-intent";

const contacts = [
  { name: "Marco", address: "0x0000000000000000000000000000000000000001" },
  { name: "Olivia", address: "0x0000000000000000000000000000000000000002" },
];

const stocks: AgentStock[] = [
  {
    symbol: "NVDA",
    name: "NVIDIA • Robinhood Token",
    shortName: "NVIDIA",
    contractAddress: "0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC",
    tokenDecimals: 18,
  },
  {
    symbol: "P",
    name: "Everpure • Robinhood Token",
    shortName: "Everpure",
    contractAddress: "0x1Cdad396DB64BDa184d5182A97Dd9B3C62100b7D",
    tokenDecimals: 18,
  },
  {
    symbol: "F",
    name: "Ford Motor • Robinhood Token",
    shortName: "Ford Motor",
    contractAddress: "0x25C288E6D899b9BC30160965aD9644c67e73bE0C",
    tokenDecimals: 18,
  },
];

describe("agent intent detail extraction", () => {
  it.each([
    ["Send 100 USDG to Marco", "100"],
    ["Deposit 20 usdg to earn", "20"],
    ["Swap $20 to NVIDIA", "20"],
    ["Buy 1.25 shares of NVIDIA", "1.25"],
  ])("extracts only the explicit amount from %s", (prompt, expected) => {
    expect(extractExplicitAmount(prompt)).toBe(expected);
  });

  it.each(["Send half my balance", "Send 20% to Marco", "Send 10 USDG and 20 USDG to Marco"])(
    "leaves ambiguous amount %s unfilled",
    (prompt) => expect(extractExplicitAmount(prompt)).toBeNull(),
  );

  it("matches one saved contact and leaves duplicate names unresolved", () => {
    expect(resolveNamedContact("Send 100 USDG to Marco", contacts)).toEqual({
      address: contacts[0].address,
      ambiguous: false,
    });
    expect(
      resolveNamedContact("Send 100 USDG to Marco", [
        ...contacts,
        {
          name: "Marco",
          address: "0x0000000000000000000000000000000000000003",
        },
      ]),
    ).toEqual({ address: "", ambiguous: true });
  });

  it("prefills explicit per-recipient amounts and an explicit each amount", () => {
    expect(resolveBatchRecipients("Send 10 USDG to Marco and 20 USDG to Olivia", contacts)).toEqual(
      [
        { address: contacts[0].address, amount: "10" },
        { address: contacts[1].address, amount: "20" },
      ],
    );
    expect(resolveBatchRecipients("Send 5 USDG each to Marco and Olivia", contacts)).toEqual([
      { address: contacts[0].address, amount: "5" },
      { address: contacts[1].address, amount: "5" },
    ]);
    expect(resolveBatchRecipients("Send 10 USDG to Marco and Olivia", contacts)).toEqual([]);
  });

  it("resolves a stock only against the catalog and recognizes the NVDIA typo", () => {
    const assets = [
      {
        symbol: "NVDA",
        name: "NVIDIA Token",
        shortName: "NVIDIA",
        contractAddress: "0xabc",
        tokenDecimals: 18,
      },
    ];
    expect(resolveStock("Swap 20 USDG to NVDIA", assets)).toEqual(assets[0]);
    expect(resolveStock("Buy AMZN", assets)).toBeNull();
  });

  it.each([
    "Swap 1 USDG to NVIDIA",
    "Swap 1 USDG to NVDA",
    "Swap 1 USDG to NVDIA",
    "swap 1 usdg to nvidia",
    "Buy 1 share of NVIDIA",
  ])("selects NVIDIA in a catalog with single-letter tickers for %s", (prompt) => {
    expect(resolveStock(prompt, stocks)).toEqual(stocks[0]);
  });

  it("matches single-letter tickers only as complete words", () => {
    expect(resolveStock("Swap 1 USDG to P", stocks)).toEqual(stocks[1]);
    expect(resolveStock("Buy 1 share of F", stocks)).toEqual(stocks[2]);
    expect(resolveStock("Swap 1 USDG to an unknown stock", stocks)).toBeNull();
    expect(resolveStock("Swap 1 USDG to NVIDIAX", stocks)).toBeNull();
  });

  it("leaves multiple named stocks unresolved, including corrected names", () => {
    expect(resolveStock("Buy NVIDIA and F for 1 USDG", stocks)).toBeNull();
    expect(resolveStock("Buy NVDIA and F for 1 USDG", stocks)).toBeNull();
  });

  it("requires an explicit stock amount unit", () => {
    expect(extractStockUnit("Buy 20 USDG of NVIDIA")).toBe("usd");
    expect(extractStockUnit("Buy 2 shares of NVIDIA")).toBe("shares");
    expect(extractStockUnit("Buy NVIDIA")).toBeNull();
  });
});
