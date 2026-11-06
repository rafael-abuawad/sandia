/** Pure settlement rules. Convex handlers apply them. */

export const MAX_ACTIVE_DEPOSITS_PER_REQUEST = 10;
export const MAX_ATTEMPTS_PER_REQUEST = 50;
export const RECONCILE_BATCH = 25;
export const STUCK_AFTER_MS = 30 * 60 * 1000;
/** A deposit address stays valid for at most this long, or until the request expires. */
export const DEPOSIT_WINDOW_MS = 60 * 60 * 1000;
const MIN_DEPOSIT_WINDOW_MS = 10 * 60 * 1000;

export type NearIntentsStatus =
  | "PENDING_DEPOSIT"
  | "KNOWN_DEPOSIT_TX"
  | "PROCESSING"
  | "SUCCESS"
  | "INCOMPLETE_DEPOSIT"
  | "REFUNDED"
  | "FAILED";

export type NearStep =
  | { step: "wait" }
  | { step: "processing"; reason?: string }
  | { step: "verify" }
  | { step: "terminal"; status: "refunded" | "failed" | "expired"; reason?: string };

/** Maps a 1Click status to what Sandia does next. `SUCCESS` still needs on-chain proof. */
export function nextNearStep(status: string, deadline: number | undefined, now: number): NearStep {
  switch (status) {
    case "PENDING_DEPOSIT":
      if (deadline !== undefined && deadline <= now) {
        return { step: "terminal", status: "expired" };
      }
      return { step: "wait" };
    case "KNOWN_DEPOSIT_TX":
    case "PROCESSING":
      return { step: "processing" };
    case "INCOMPLETE_DEPOSIT":
      return {
        step: "processing",
        reason: "The deposit is below the required amount and will be refunded.",
      };
    case "SUCCESS":
      return { step: "verify" };
    case "REFUNDED":
      return { step: "terminal", status: "refunded" };
    case "FAILED":
      return { step: "terminal", status: "failed", reason: "The cross-chain route failed." };
    default:
      return { step: "wait" };
  }
}

export function isReconciliationStuck(createdAt: number, now: number): boolean {
  return now - createdAt > STUCK_AFTER_MS;
}

/** The earlier of one hour from now and the request's own expiry. Null when too little time is left. */
export function depositDeadline(now: number, expiresAt: number | undefined): number | null {
  const window = now + DEPOSIT_WINDOW_MS;
  const deadline = expiresAt === undefined ? window : Math.min(window, expiresAt);
  return deadline - now < MIN_DEPOSIT_WINDOW_MS ? null : deadline;
}

/** A settlement can't predate the request or deposit it claims to settle. */
export function settlesAfter(txCreatedAt: string, notBefore: number): boolean {
  const created = Date.parse(txCreatedAt);
  return Number.isFinite(created) && created >= notBefore;
}
