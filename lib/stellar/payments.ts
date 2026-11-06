import { amountToStroops } from "./amount";
import { STELLAR_USDC } from "./constants";
import type { HorizonOperation } from "./horizon";

const PAYMENT_TYPES = new Set([
  "payment",
  "path_payment_strict_receive",
  "path_payment_strict_send",
]);

export type UsdcPayment = { to: string; toMuxed?: string; amount: bigint };

/** USDC payments in a transaction's operations. Other assets and operations are ignored. */
export function parseUsdcPayments(operations: HorizonOperation[]): UsdcPayment[] {
  const payments: UsdcPayment[] = [];
  for (const operation of operations) {
    if (!PAYMENT_TYPES.has(operation.type)) continue;
    if (operation.transaction_successful === false) continue;
    if (operation.asset_code !== STELLAR_USDC.symbol) continue;
    if (operation.asset_issuer !== STELLAR_USDC.issuer) continue;
    if (!operation.to || !operation.amount) continue;
    payments.push({
      to: operation.to,
      toMuxed: operation.to_muxed,
      amount: amountToStroops(operation.amount),
    });
  }
  return payments;
}

function paysRecipient(payment: UsdcPayment, recipient: string): boolean {
  return recipient.startsWith("M") ? payment.toMuxed === recipient : payment.to === recipient;
}

/** A settlement pays the recipient at least the requested amount in one operation. */
export function matchRequestPayment(
  payments: UsdcPayment[],
  expected: { recipient: string; amount: string },
): { ok: true; amount: bigint } | { ok: false; reason: string } {
  const required = BigInt(expected.amount);
  const match = payments.find(
    (payment) => paysRecipient(payment, expected.recipient) && payment.amount >= required,
  );
  if (!match) {
    return {
      ok: false,
      reason: "This transaction has no USDC payment to the recipient for the requested amount",
    };
  }
  return { ok: true, amount: match.amount };
}

export type ExpectedSend = { recipient: string; amount: string };

/** Every recipient of a send must receive exactly the reviewed amount. */
export function matchSendPayments(
  payments: UsdcPayment[],
  expected: ExpectedSend[],
): { ok: true } | { ok: false; reason: string } {
  for (const row of expected) {
    const amount = BigInt(row.amount);
    const match = payments.some(
      (payment) => paysRecipient(payment, row.recipient) && payment.amount === amount,
    );
    if (!match) {
      return { ok: false, reason: `Missing USDC payment of ${row.amount} to ${row.recipient}` };
    }
  }
  return { ok: true };
}
