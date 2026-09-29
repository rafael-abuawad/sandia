import { describe, expect, it } from "vitest";
import { validateReviewPayload } from "./helpers";
import type { RecipientRow } from "./state";

const validAddress = "0x1111111111111111111111111111111111111111";

describe("validateReviewPayload", () => {
  it("attaches single send address and amount errors to their fields", () => {
    const result = validateReviewPayload("single", "bad address", "0", []);

    expect(result.review).toBeNull();
    expect(result.fieldErrors.single).toEqual({
      address: "Enter a valid recipient address",
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

  it("marks both rows when a massive send repeats an address", () => {
    const rows: RecipientRow[] = [
      { id: "first", address: validAddress, amount: "1" },
      { id: "second", address: validAddress.toUpperCase().replace("0X", "0x"), amount: "2" },
    ];

    const result = validateReviewPayload("massive", "", "", rows);

    expect(result.review).toBeNull();
    expect(result.fieldErrors.first?.address).toMatch(/Duplicate address/);
    expect(result.fieldErrors.second?.address).toMatch(/Duplicate address/);
  });

  it("rejects a total that cannot be represented safely", () => {
    const rows = [1, 2, 3].map((index) => ({
      id: String(index),
      address: `0x${index.toString().padStart(40, "0")}`,
      amount: "9007199254.740991",
    }));

    expect(validateReviewPayload("massive", "", "", rows).error).toBe(
      "The total amount is too large",
    );
  });
});
