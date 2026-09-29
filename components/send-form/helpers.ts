import { isAddress } from "viem";
import { parseUsdToMicros } from "@/lib/money";
import { MAX_SEND_RECIPIENTS } from "@/lib/send/calls";
import {
  newRecipientRow,
  type RecipientRow,
  type ReviewPayload,
  type ReviewRecipient,
  type SendMode,
} from "@/components/send-form/state";

export type SendFieldErrors = Record<string, { address?: string; amount?: string }>;

export type SendValidation = {
  review: ReviewPayload | null;
  error: string | null;
  fieldErrors: SendFieldErrors;
};

export function truncateAddress(address: string): string {
  if (address.length < 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** Parse CSV of `address,amount` (optional header). Returns at least two rows. */
export function parseRecipientsCsv(text: string): RecipientRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    throw new Error("CSV is empty");
  }

  let start = 0;
  const firstCells = lines[0].split(",").map((c) => c.trim().toLowerCase());
  if (firstCells.some((c) => c.includes("address") || c.includes("amount"))) {
    start = 1;
  }

  const parsed: RecipientRow[] = [];
  for (let i = start; i < lines.length; i++) {
    const cells = lines[i].split(",").map((c) => c.trim().replace(/^["']|["']$/g, ""));
    if (cells.length < 2) {
      throw new Error(`Line ${i + 1}: expected address,amount`);
    }
    const [address, amount] = cells;
    if (!address || !amount) {
      throw new Error(`Line ${i + 1}: address and amount are required`);
    }
    parsed.push({ id: crypto.randomUUID(), address, amount });
  }

  if (parsed.length === 0) {
    throw new Error("CSV has no recipient rows");
  }

  while (parsed.length < 2) {
    parsed.push(newRecipientRow());
  }

  return parsed;
}

export function validateReviewPayload(
  mode: SendMode,
  singleAddress: string,
  singleAmount: string,
  rows: RecipientRow[],
): SendValidation {
  const fieldErrors: SendFieldErrors = {};
  if (mode === "single") {
    let amountUsdMicros: number | null = null;
    if (!isAddress(singleAddress)) {
      fieldErrors.single = { address: "Enter a valid recipient address" };
    }
    try {
      amountUsdMicros = parseUsdToMicros(singleAmount);
    } catch (err) {
      fieldErrors.single = {
        ...fieldErrors.single,
        amount: err instanceof Error ? err.message : "Enter a valid amount",
      };
    }
    if (!isAddress(singleAddress) || amountUsdMicros === null) {
      return { review: null, error: null, fieldErrors };
    }
    return {
      error: null,
      fieldErrors,
      review: {
        mode,
        recipients: [
          {
            address: singleAddress as `0x${string}`,
            amountUsdMicros,
          },
        ],
        totalUsdMicros: amountUsdMicros,
      },
    };
  }

  if (rows.length < 2) {
    return { review: null, error: "Massive send needs at least two recipients", fieldErrors };
  }
  if (rows.length > MAX_SEND_RECIPIENTS) {
    return {
      review: null,
      error: `A batch can include at most ${MAX_SEND_RECIPIENTS} recipients`,
      fieldErrors,
    };
  }

  const recipients: ReviewRecipient[] = [];
  const seen = new Map<string, number>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const label = `Recipient ${i + 1}`;
    let rowHasError = false;
    if (!isAddress(row.address)) {
      fieldErrors[row.id] = { address: `${label}: enter a valid address` };
      rowHasError = true;
    } else {
      const normalized = row.address.toLowerCase();
      const duplicateIndex = seen.get(normalized);
      if (duplicateIndex !== undefined) {
        const original = rows[duplicateIndex];
        if (original) {
          fieldErrors[original.id] = {
            ...fieldErrors[original.id],
            address: `Duplicate address: ${truncateAddress(original.address)}`,
          };
        }
        fieldErrors[row.id] = {
          ...fieldErrors[row.id],
          address: `Duplicate address: ${truncateAddress(row.address)}`,
        };
        rowHasError = true;
      } else {
        seen.set(normalized, i);
      }
    }

    let amountUsdMicros: number | null = null;
    try {
      amountUsdMicros = parseUsdToMicros(row.amount);
    } catch (err) {
      fieldErrors[row.id] = {
        ...fieldErrors[row.id],
        amount: `${label}: ${err instanceof Error ? err.message : "invalid amount"}`,
      };
      rowHasError = true;
    }

    if (!rowHasError && isAddress(row.address) && amountUsdMicros !== null) {
      recipients.push({
        address: row.address as `0x${string}`,
        amountUsdMicros,
      });
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { review: null, error: null, fieldErrors };
  }

  const totalUsdMicros = recipients.reduce((sum, r) => sum + r.amountUsdMicros, 0);
  if (!Number.isSafeInteger(totalUsdMicros)) {
    return { review: null, error: "The total amount is too large", fieldErrors };
  }

  return {
    review: { mode, recipients, totalUsdMicros },
    error: null,
    fieldErrors,
  };
}

export function buildReviewPayload(
  mode: SendMode,
  singleAddress: string,
  singleAmount: string,
  rows: RecipientRow[],
): ReviewPayload {
  const result = validateReviewPayload(mode, singleAddress, singleAmount, rows);
  if (result.review) return result.review;
  if (result.error) throw new Error(result.error);
  const firstFieldError = Object.values(result.fieldErrors)[0];
  throw new Error(
    firstFieldError?.address ?? firstFieldError?.amount ?? "Check the recipient and amount",
  );
}
