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
      <h3 className="text-sm font-medium text-foreground">Attempts</h3>
      <ul className="space-y-2">
        {attempts.map((a) => (
          <li
            key={a._id}
            className="flex items-center justify-between rounded-lg border border-border bg-panel px-3 py-2 text-xs text-muted"
          >
            <span className="font-mono">
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
      <section className="rounded-[var(--radius-xl)] border border-info/30 bg-[var(--info-soft)] p-6 text-sm text-info">
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
    <section className="rounded-[var(--radius-xl)] border border-border bg-foreground/5 p-6 text-sm text-muted">
      This request is {statusLabel} and cannot be paid.
    </section>
  );
}
