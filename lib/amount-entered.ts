export function isAmountEntered(value: string): boolean {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) && n > 0;
}
