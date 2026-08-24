"use client";

import { use, useId, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { LoginButton } from "@/components/login-button";
import { useSignedInWallet } from "@/lib/use-signed-in-wallet";
import { api } from "@/convex/_generated/api";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { formatTokenAmount, formatUsdFromMicros } from "@/lib/money";
import { shortenAddress } from "@/lib/utils";

export default function RequestDetailPage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = use(params);
  const { isSignedIn } = useSignedInWallet();
  const request = useQuery(
    api.paymentRequests.getMineByPublicId,
    isSignedIn ? { publicId } : "skip",
  );
  const attempts = useQuery(api.paymentAttempts.listByRequest, { publicId });
  const cancel = useMutation(api.paymentRequests.cancel);
  const errorId = useId();
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isSignedIn) {
    return (
      <div className="pr-page pr-page--narrow text-center">
        <h1 className="pr-display text-2xl">Payment request</h1>
        <p className="text-sm text-muted">
          Sign in with the creator account to manage this request.
        </p>
        <div className="flex justify-center">
          <LoginButton />
        </div>
      </div>
    );
  }

  if (request === undefined) {
    return <p className="text-sm text-muted">Loading…</p>;
  }

  if (request === null) {
    return (
      <div className="pr-page pr-page--narrow">
        <h1 className="pr-display text-2xl">Request not found</h1>
        <p className="text-sm text-danger">This request is not available for this account.</p>
      </div>
    );
  }

  const payUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/pay/${publicId}`
      : `/pay/${publicId}`;

  async function onCancel() {
    setBusy(true);
    setError(null);
    try {
      await cancel({ publicId });
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
    <div className="pr-page pr-page--measure">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="pr-display pr-money text-2xl">
            ${formatUsdFromMicros(request.amountUsdMicros)}
          </h1>
          <p className="mt-1 pr-money text-sm text-muted">
            {formatTokenAmount(request.outputAmountBaseUnits, request.destinationTokenDecimals)}{" "}
            {request.destinationTokenSymbol} → {shortenAddress(request.recipientAddress, 6)}
          </p>
        </div>
        <StatusBadge status={request.status} />
      </div>

      <div className="pr-panel pr-panel--padded space-y-3">
        <p className="pr-kicker">Public payment URL</p>
        <p className="pr-mono break-all text-sm text-foreground">{payUrl}</p>
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
            className="pr-inset pr-inset--danger space-y-3 p-3"
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
          <h2 className="pr-section-title">Payment attempts</h2>
          <ul className="space-y-2">
            {attempts.map((a: { _id: string; depositTxnRef?: string; acrossStatus: string }) => (
              <li
                key={a._id}
                className="pr-inset flex items-center justify-between gap-3 px-3 py-2 text-xs text-muted"
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
