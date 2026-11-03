import { describe, expect, it } from "vitest";
import {
  extractExplicitAmount,
  extractLeverage,
  resolveBatchRecipients,
  resolveMarket,
  resolveNamedContact,
} from "./agent-intent";
import type { AgentMarket } from "./agent-intent";

const contacts = [
  { name: "Marco", address: "0x0000000000000000000000000000000000000001" },
  { name: "Olivia", address: "0x0000000000000000000000000000000000000002" },
];

const markets: AgentMarket[] = [
  { coin: "BTC", symbol: "BTC", name: "BTC", keywords: [] },
  { coin: "xyz:NVDA", symbol: "NVDA", name: "Nvidia", keywords: ["nvidia", "semis"] },
  { coin: "xyz:F", symbol: "F", name: "Ford", keywords: ["ford", "auto"] },
  { coin: "xyz:TSLA", symbol: "TSLA", name: "Tesla", keywords: ["tesla", "auto"] },
  { coin: "flx:BTC", symbol: "BTC", name: "BTC", keywords: [] },
];

describe("agent intent detail extraction", () => {
  it.each([
    ["Send 100 USDC to Marco", "100"],
    ["Short 20 usdc of ETH", "20"],
    ["Swap $20 to NVIDIA", "20"],
    ["Long 1.25 dollars of NVIDIA", "1.25"],
  ])("extracts only the explicit amount from %s", (prompt, expected) => {
    expect(extractExplicitAmount(prompt)).toBe(expected);
  });

  it.each(["Send half my balance", "Send 20% to Marco", "Send 10 USDC and 20 USDC to Marco"])(
    "leaves ambiguous amount %s unfilled",
    (prompt) => expect(extractExplicitAmount(prompt)).toBeNull(),
  );

  it("matches one saved contact and leaves duplicate names unresolved", () => {
    expect(resolveNamedContact("Send 100 USDC to Marco", contacts)).toEqual({
      address: contacts[0].address,
      ambiguous: false,
    });
    expect(
      resolveNamedContact("Send 100 USDC to Marco", [
        ...contacts,
        {
          name: "Marco",
          address: "0x0000000000000000000000000000000000000003",
        },
      ]),
    ).toEqual({ address: "", ambiguous: true });
  });

  it("prefills explicit per-recipient amounts and an explicit each amount", () => {
    expect(resolveBatchRecipients("Send 10 USDC to Marco and 20 USDC to Olivia", contacts)).toEqual(
      [
        { address: contacts[0].address, amount: "10" },
        { address: contacts[1].address, amount: "20" },
      ],
    );
    expect(resolveBatchRecipients("Send 5 USDC each to Marco and Olivia", contacts)).toEqual([
      { address: contacts[0].address, amount: "5" },
      { address: contacts[1].address, amount: "5" },
    ]);
    expect(resolveBatchRecipients("Send 10 USDC to Marco and Olivia", contacts)).toEqual([]);
  });

  it("resolves one market by ticker or name, with common aliases", () => {
    expect(resolveMarket("Long 50 USDC of Tesla 5x", markets)?.coin).toBe("xyz:TSLA");
    expect(resolveMarket("Short NVDIA", markets)?.coin).toBe("xyz:NVDA");
    expect(resolveMarket("long bitcoin", markets)?.coin).toBe("BTC");
  });

  it("matches single-letter tickers only as whole words and ignores shared topics", () => {
    expect(resolveMarket("Buy F for 10 USDC", markets)?.coin).toBe("xyz:F");
    expect(resolveMarket("Long auto stocks", markets)).toBeNull();
    expect(resolveMarket("Long an unknown coin", markets)).toBeNull();
  });

  it("leaves several named markets unresolved", () => {
    expect(resolveMarket("Long Tesla and Nvidia", markets)).toBeNull();
  });

  it("reads leverage", () => {
    expect(extractLeverage("Long BTC 10x with $20")).toBe(10);
    expect(extractLeverage("Long BTC")).toBeNull();
    expect(extractLeverage("Long BTC 80x")).toBeNull();
  });
});
