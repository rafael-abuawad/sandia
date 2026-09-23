import { isAddress } from "viem";
import { parseUsdToMicros } from "@/lib/money";
import {
  newRecipientRow,
  type RecipientRow,
  type ReviewPayload,
  type ReviewRecipient,
  type SendMode,
} from "@/components/send-form/state";

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

export function buildReviewPayload(
  mode: SendMode,
  singleAddress: string,
  singleAmount: string,
  rows: RecipientRow[],
): ReviewPayload {
  if (mode === "single") {
    if (!isAddress(singleAddress)) {
      throw new Error("Enter a valid recipient address");
    }
    const amountUsdMicros = parseUsdToMicros(singleAmount);
    return {
      mode,
      recipients: [
        {
          address: singleAddress as `0x${string}`,
          amountUsdMicros,
        },
      ],
      totalUsdMicros: amountUsdMicros,
    };
  }

  if (rows.length < 2) {
    throw new Error("Massive send needs at least two recipients");
  }
  if (rows.length > 20) {
    throw new Error("A batch can include at most 20 recipients");
  }

  const recipients: ReviewRecipient[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const label = `Recipient ${i + 1}`;
    if (!isAddress(row.address)) {
      throw new Error(`${label}: enter a valid address`);
    }
    const normalized = row.address.toLowerCase();
    if (seen.has(normalized)) {
      throw new Error(`Duplicate address: ${truncateAddress(row.address)}`);
    }
    seen.add(normalized);

    let amountUsdMicros: number;
    try {
      amountUsdMicros = parseUsdToMicros(row.amount);
    } catch (err) {
      throw new Error(`${label}: ${err instanceof Error ? err.message : "invalid amount"}`);
    }

    recipients.push({
      address: row.address as `0x${string}`,
      amountUsdMicros,
    });
  }

  const totalUsdMicros = recipients.reduce((sum, r) => sum + r.amountUsdMicros, 0);

  return { mode, recipients, totalUsdMicros };
}
