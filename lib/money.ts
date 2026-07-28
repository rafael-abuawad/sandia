/** Integer money helpers — never use floating point for token/USD math. */

export const USD_MICROS_PER_DOLLAR = BigInt(1_000_000);

/** Parse a USD decimal string like "12.34" into integer micros (1e6). */
export function parseUsdToMicros(input: string): number {
  const trimmed = input.trim();
  if (!/^\d+(\.\d{1,6})?$/.test(trimmed)) {
    throw new Error("Enter a valid USD amount with up to 6 decimal places");
  }
  const [whole, frac = ""] = trimmed.split(".");
  const fracPadded = (frac + "000000").slice(0, 6);
  const micros = BigInt(whole) * USD_MICROS_PER_DOLLAR + BigInt(fracPadded);
  if (micros <= BigInt(0)) throw new Error("Amount must be greater than zero");
  if (micros > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Amount too large");
  }
  return Number(micros);
}

export function formatUsdFromMicros(micros: number): string {
  const negative = micros < 0;
  const abs = BigInt(Math.abs(micros));
  const whole = abs / USD_MICROS_PER_DOLLAR;
  const frac = (abs % USD_MICROS_PER_DOLLAR).toString().padStart(6, "0").replace(/0+$/, "");
  const body = frac.length > 0 ? `${whole}.${frac}` : whole.toString();
  return negative ? `-${body}` : body;
}

export function formatTokenAmount(baseUnits: string, decimals: number): string {
  const value = BigInt(baseUnits);
  const negative = value < BigInt(0);
  const abs = negative ? -value : value;
  const base = BigInt(10) ** BigInt(decimals);
  const whole = abs / base;
  const frac = (abs % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  const body = frac.length > 0 ? `${whole}.${frac}` : whole.toString();
  return negative ? `-${body}` : body;
}

/**
 * Display helper — same decimal math as formatTokenAmount, with grouping
 * separators (e.g. 1234.5 → "1,234.5"). Safe for labels; not for inputs.
 */
export function formatTokenAmountGrouped(
  baseUnits: string,
  decimals: number,
  maxFractionDigits = decimals,
): string {
  const raw = formatTokenAmount(baseUnits, decimals);
  const negative = raw.startsWith("-");
  const body = negative ? raw.slice(1) : raw;
  const [whole, frac = ""] = body.split(".");
  const wholeGrouped = BigInt(whole).toLocaleString("en-US");
  const fracCapped = frac.slice(0, Math.max(0, maxFractionDigits)).replace(/0+$/, "");
  const out = fracCapped.length > 0 ? `${wholeGrouped}.${fracCapped}` : wholeGrouped;
  return negative ? `-${out}` : out;
}
