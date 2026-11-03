/**
 * Across app fee settings. `ACROSS_APP_FEE` is a fraction of the output (0.001 = 0.1%) and
 * `ACROSS_APP_FEE_RECIPIENT` receives it. Both must be set; there is no default recipient.
 */
const MAX_APP_FEE = 0.01;

export function acrossAppFeeParams(
  env: Record<string, string | undefined> = process.env,
): { appFee: string; appFeeRecipient: string } | null {
  const raw = env.ACROSS_APP_FEE?.trim();
  if (!raw) return null;
  const fee = Number(raw);
  if (!Number.isFinite(fee) || fee <= 0 || fee > MAX_APP_FEE) return null;
  const recipient = env.ACROSS_APP_FEE_RECIPIENT?.trim().toLowerCase() ?? "";
  if (!/^0x[0-9a-f]{40}$/.test(recipient)) return null;
  return { appFee: String(fee), appFeeRecipient: recipient };
}
