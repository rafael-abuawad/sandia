import { describe, expect, it } from "vitest";
import {
  extractExplicitAmount,
  extractStockUnit,
  resolveBatchRecipients,
  resolveNamedContact,
  resolveStock,
} from "./agent-intent";

const contacts = [
  { name: "Marco", address: "0x0000000000000000000000000000000000000001" },
  { name: "Olivia", address: "0x0000000000000000000000000000000000000002" },
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
      { symbol: "NVDA", name: "NVIDIA Token", shortName: "NVIDIA", contractAddress: "0xabc" },
    ];
    expect(resolveStock("Swap 20 USDG to NVDIA", assets)).toEqual(assets[0]);
    expect(resolveStock("Buy AMZN", assets)).toBeNull();
  });

  it("requires an explicit stock amount unit", () => {
    expect(extractStockUnit("Buy 20 USDG of NVIDIA")).toBe("usd");
    expect(extractStockUnit("Buy 2 shares of NVIDIA")).toBe("shares");
    expect(extractStockUnit("Buy NVIDIA")).toBeNull();
  });
});
