import { describe, expect, it } from "vitest";
import {
  extractExplicitAmount,
  resolveExplicitAddress,
  resolveBatchRecipients,
  resolveNamedContact,
} from "./agent-intent";

const contacts = [
  { name: "Marco", address: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN" },
  { name: "Olivia", address: "GBD7QFQVR4QWNEJSHP4VN7RAAUKXTMZ4EJ4EBMCR7CP3HMF7RXEASTD7" },
];

describe("agent intent detail extraction", () => {
  it.each([
    ["Send 100 USDC to Marco", "100"],
    ["Request 20 usdc from Olivia", "20"],
    ["Send $20 to Marco", "20"],
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
          address: "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ",
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

  it("reads Stellar addresses, keeping their case and checking their checksum", () => {
    const address = contacts[0].address;
    expect(resolveExplicitAddress(`Send 5 USDC to ${address}`)).toBe(address);
    expect(resolveExplicitAddress(`Send 5 USDC to ${address.slice(0, -1)}A`)).toBe("");
    expect(resolveExplicitAddress(`Send 5 USDC to 0x${"1".repeat(40)}`)).toBe("");
  });
});
