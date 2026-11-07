"use client";

import { StatusBadge } from "@/components/status-badge";
import { TxLink } from "@/components/tx-link";
import { shortenAddress } from "@/lib/utils";

type Attempt = {
  _id: string;
  kind: "direct" | "near_intents";
  txHash?: string;
  originSymbol?: string;
  originChain?: string;
  status: string;
};

export function PayAttemptsList({ attempts }: { attempts: Attempt[] }) {
  if (attempts.length === 0) return null;

  return (
    <section className="space-y-3">
      <h3 className="pr-section-title">Attempts</h3>
      <ul className="space-y-2">
        {attempts.map((a) => (
          <li
            key={a._id}
            className="pr-inset flex items-center justify-between px-3 py-2 text-xs text-muted"
          >
            <span>
              {a.txHash ? (
                <TxLink hash={a.txHash} className="text-xs">
                  {shortenAddress(a.txHash, 6)}
                </TxLink>
              ) : a.kind === "near_intents" ? (
                `${a.originSymbol ?? "Token"} on ${a.originChain ?? "another network"}`
              ) : (
                "no tx yet"
              )}
            </span>
            <StatusBadge status={a.status} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function unavailableCopy(status: string | undefined): string {
  switch (status?.toLowerCase()) {
    case "cancelled":
      return "This request was cancelled and can no longer be paid.";
    case "expired":
      return "This request expired and can no longer be paid.";
    case "failed":
      return "This request failed and can no longer be paid.";
    default:
      return "This request can no longer be paid.";
  }
}

export function PayTerminalStatus({
  kind,
  statusLabel,
  txHash,
  message,
}: {
  kind: "completed" | "unavailable";
  statusLabel?: string;
  txHash?: string | null;
  message?: string | null;
}) {
  if (kind === "completed") {
    return (
      <section className="pr-inset pr-inset--success p-5 text-sm text-success">
        {message ?? "Payment complete. USDC settled on Stellar."}
        {txHash ? (
          <p className="mbs-2 text-xs text-muted">
            Transaction:{" "}
            <TxLink hash={txHash} className="text-xs">
              {shortenAddress(txHash, 8)}
            </TxLink>
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <section className="pr-inset pr-inset--muted p-5 text-sm text-muted">
      {unavailableCopy(statusLabel)}
    </section>
  );
}
