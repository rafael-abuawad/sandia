"use client";

import { StatusBadge } from "@/components/status-badge";
import { shortenAddress } from "@/lib/utils";

type Attempt = {
  _id: string;
  depositTxnRef?: string;
  acrossStatus: string;
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
            <span className="pr-mono">
              {a.depositTxnRef ? shortenAddress(a.depositTxnRef, 6) : "no tx yet"}
            </span>
            <StatusBadge status={a.acrossStatus} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PayTerminalStatus({
  kind,
  statusLabel,
  depositTxnRef,
}: {
  kind: "completed" | "unavailable";
  statusLabel?: string;
  depositTxnRef?: string | null;
}) {
  if (kind === "completed") {
    return (
      <section className="pr-inset pr-inset--success p-5 text-sm text-success">
        Payment completed. Stablecoin settled on Robinhood Chain.
        {depositTxnRef && (
          <p className="mt-2 pr-mono text-xs text-muted">
            Deposit: {shortenAddress(depositTxnRef, 8)}
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="pr-inset pr-inset--muted p-5 text-sm text-muted">
      This request is {statusLabel} and cannot be paid.
    </section>
  );
}
