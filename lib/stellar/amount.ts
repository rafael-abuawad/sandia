/** Stellar USDC has 7 decimals. Sandia amounts are USD micros (6 decimals). */
const STROOPS_PER_MICRO = 10n;
const STROOPS_PER_UNIT = 10_000_000n;

export function usdMicrosToStroops(micros: number): bigint {
  if (!Number.isSafeInteger(micros) || micros <= 0) {
    throw new Error("Amount must be greater than zero");
  }
  return BigInt(micros) * STROOPS_PER_MICRO;
}

/** The decimal string Stellar operations use, such as `12.5000000`. */
export function stroopsToAmount(stroops: bigint): string {
  if (stroops < 0n) throw new Error("Amount can't be negative");
  const whole = stroops / STROOPS_PER_UNIT;
  const fraction = (stroops % STROOPS_PER_UNIT).toString().padStart(7, "0");
  return `${whole}.${fraction}`;
}

export function amountToStroops(amount: string): bigint {
  const trimmed = amount.trim();
  if (!/^\d+(\.\d{1,7})?$/.test(trimmed)) throw new Error("Invalid Stellar amount");
  const [whole, fraction = ""] = trimmed.split(".");
  return BigInt(whole) * STROOPS_PER_UNIT + BigInt(fraction.padEnd(7, "0"));
}

/** Parses a USD field into USDC stroops. Sandia accepts up to 6 decimals, like every other amount. */
export function parseUsdcStroops(input: string): bigint {
  const trimmed = input.trim().replace(/,/g, "");
  if (!/^\d+(\.\d{1,6})?$/.test(trimmed)) {
    throw new Error("Enter a valid USDC amount with up to 6 decimal places");
  }
  const stroops = amountToStroops(trimmed);
  if (stroops <= 0n) throw new Error("Amount must be greater than zero");
  return stroops;
}
