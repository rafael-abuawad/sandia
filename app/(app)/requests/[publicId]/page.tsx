"use client";

import { use, useId, useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { ConnectKitButton } from "connectkit";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { formatTokenAmount, formatUsdFromMicros } from "@/lib/money";
import { shortenAddress } from "@/lib/utils";

export default function RequestDetailPage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = use(params);
  const { address, isConnected } = useAccount();
  const request = useQuery(
    api.paymentRequests.getMineByPublicId,
    address ? { creatorAddress: address, publicId } : "skip",
  );
  const attempts = useQuery(api.paymentAttempts.listByRequest, { publicId });
  const cancel = useMutation(api.paymentRequests.cancel);
  const errorId = useId();
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isConnected || !address) {
    return (
      <div className="mx-auto max-w-md space-y-4 text-center">
        <p className="text-sm text-muted">Connect the creator wallet to manage this request.</p>
        <div className="flex justify-center">
          <ConnectKitButton />
        </div>
      </div>
    );
  }

  if (request === undefined) {
    return <p className="text-sm text-muted">Loading…</p>;
  }

  if (request === null) {
    return <p className="text-sm text-danger">Request not found for this wallet.</p>;
  }

  const payUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/pay/${publicId}`
      : `/pay/${publicId}`;

  async function onCancel() {
    if (!address) return;
    setBusy(true);
    setError(null);
    try {
      await cancel({ creatorAddress: address, publicId });
      setConfirmCancel(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to cancel request. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(payUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="pr-display text-2xl">${formatUsdFromMicros(request.amountUsdMicros)}</h1>
          <p className="mt-1 text-sm text-muted">
            {formatTokenAmount(request.outputAmountBaseUnits, request.destinationTokenDecimals)}{" "}
            {request.destinationTokenSymbol} → {shortenAddress(request.recipientAddress, 6)}
          </p>
        </div>
        <StatusBadge status={request.status} />
      </div>

      <div className="pr-panel space-y-3 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-subtle">
          Public payment URL
        </p>
        <p className="pr-mono break-all text-sm text-[var(--accent-ink)]">{payUrl}</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => void copyLink()}>
            {copied ? "Copied" : "Copy link"}
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href={`/pay/${publicId}`}>Open pay page</Link>
          </Button>
          {request.status === "open" && !confirmCancel && (
            <Button
              size="sm"
              variant="destructive"
              disabled={busy}
              onClick={() => setConfirmCancel(true)}
            >
              Cancel request
            </Button>
          )}
        </div>
        {confirmCancel && request.status === "open" && (
          <div
            className="space-y-3 rounded-lg border border-danger/30 bg-[var(--danger-soft)] p-3"
            role="group"
            aria-label="Confirm cancel request"
          >
            <p className="text-sm text-foreground">
              Cancel this payment request? Payers will no longer be able to settle it.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="destructive"
                disabled={busy}
                onClick={() => void onCancel()}
              >
                {busy ? "Cancelling…" : "Cancel request"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => setConfirmCancel(false)}
              >
                Keep request
              </Button>
            </div>
          </div>
        )}
        <FieldError id={errorId} message={error} />
      </div>

      {request.description && <p className="text-sm text-muted">{request.description}</p>}

      {attempts && attempts.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">Payment attempts</h2>
          <ul className="space-y-2">
            {attempts.map((a: { _id: string; depositTxnRef?: string; acrossStatus: string }) => (
              <li
                key={a._id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-xs text-muted"
              >
                <span className="pr-mono min-w-0 truncate">
                  {a.depositTxnRef ? shortenAddress(a.depositTxnRef, 6) : "—"}
                </span>
                <StatusBadge status={a.acrossStatus} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
