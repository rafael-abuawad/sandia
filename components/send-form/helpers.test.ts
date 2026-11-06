import { Keypair } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";
import { validateReviewPayload } from "./helpers";
import type { RecipientRow } from "./state";

const validAddress = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";

describe("validateReviewPayload", () => {
  it("attaches single send address and amount errors to their fields", () => {
    const result = validateReviewPayload("single", "bad address", "0", []);

    expect(result.review).toBeNull();
    expect(result.fieldErrors.single).toEqual({
      address: "Enter a valid Stellar address",
      amount: "Amount must be greater than zero",
    });
  });

  it("shows malformed amounts beside the amount field", () => {
    const result = validateReviewPayload("single", validAddress, "1..2", []);

    expect(result.review).toBeNull();
    expect(result.fieldErrors.single?.amount).toBe(
      "Enter a valid USD amount with up to 6 decimal places",
    );
  });

  it("rejects an EVM address and a lowercased Stellar address", () => {
    for (const address of [`0x${"1".repeat(40)}`, validAddress.toLowerCase()]) {
      expect(validateReviewPayload("single", address, "1", []).review).toBeNull();
    }
  });

  it("carries a memo on a single send, and rejects one that's too long", () => {
    const ok = validateReviewPayload("single", validAddress, "1", [], " 12345 ");
    expect(ok.review?.memo).toBe("12345");

    const long = validateReviewPayload("single", validAddress, "1", [], "x".repeat(29));
    expect(long.review).toBeNull();
    expect(long.fieldErrors.single?.memo).toContain("28 bytes");
  });

  it("marks both rows when a massive send repeats an address", () => {
    const rows: RecipientRow[] = [
      { id: "first", address: validAddress, amount: "1" },
      { id: "second", address: ` ${validAddress} `, amount: "2" },
    ];

    const result = validateReviewPayload("massive", "", "", rows);

    expect(result.review).toBeNull();
    expect(result.fieldErrors.first?.address).toMatch(/Duplicate address/);
    expect(result.fieldErrors.second?.address).toMatch(/Duplicate address/);
  });

  it("caps a batch at Stellar's 100 operations", () => {
    const rows = Array.from({ length: 101 }, (_, index) => ({
      id: String(index),
      address: Keypair.random().publicKey(),
      amount: "1",
    }));
    expect(validateReviewPayload("massive", "", "", rows).error).toContain("at most 100");
    expect(
      validateReviewPayload("massive", "", "", rows.slice(0, 100)).review?.recipients,
    ).toHaveLength(100);
  });

  it("rejects a total that cannot be represented safely", () => {
    const rows = [1, 2, 3].map((index) => ({
      id: String(index),
      address: Keypair.random().publicKey(),
      amount: "9007199254.740991",
    }));

    expect(validateReviewPayload("massive", "", "", rows).error).toBe(
      "The total amount is too large",
    );
  });
});
