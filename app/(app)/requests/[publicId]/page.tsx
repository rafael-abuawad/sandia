"use client";

import { use, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { Check, Copy, Share } from "lucide-react";
import { PaymentQr, paymentQrToPngFile } from "@/components/payment-qr";
import { LoginButton } from "@/components/login-button";
import { useSignedInWallet } from "@/lib/use-signed-in-wallet";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { formatDisplayDateTime } from "@/lib/format-datetime";
import { formatTokenAmount, formatUsdFromMicros } from "@/lib/money";
import { userFacingError } from "@/lib/user-facing-error";
import RequestDetailLoading from "./loading";

export default function RequestDetailPage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = use(params);
  return <RequestDetail publicId={publicId} />;
}

function RequestDetail({ publicId }: { publicId: string }) {
  const { ready, isSignedIn } = useSignedInWallet();
  const request = useQuery(
    api.paymentRequests.getMineByPublicId,
    isSignedIn ? { publicId } : "skip",
  );
  const { results: attempts } = usePaginatedQuery(
    api.paymentAttempts.listByRequest,
    { publicId },
    { initialNumItems: 20 },
  );

  if (!ready) {
    return <RequestDetailLoading />;
  }

  if (!isSignedIn) {
    return <RequestSignedOut />;
  }

  if (request === undefined) {
    return <RequestDetailLoading />;
  }

  if (request === null) {
    return <RequestMissing />;
  }

  return <RequestDetailLoaded publicId={publicId} request={request} attempts={attempts} />;
}

function RequestSignedOut() {
  return (
    <div className="pr-page pr-page--narrow text-center">
      <h1 className="pr-display text-2xl">Payment request</h1>
      <p className="text-sm text-muted">Sign in with the creator account to manage this request.</p>
      <div className="flex justify-center">
        <LoginButton />
      </div>
    </div>
  );
}

function RequestMissing() {
  return (
    <div className="pr-page pr-page--narrow">
      <h1 className="pr-display text-2xl">Request not found</h1>
      <p className="text-sm text-danger">This request is not available for this account.</p>
    </div>
  );
}

type AttemptRow = { _id: string; depositTxnRef?: string; acrossStatus: string };

function RequestDetailLoaded({
  publicId,
  request,
  attempts,
}: {
  publicId: string;
  request: Doc<"paymentRequests">;
  attempts: AttemptRow[];
}) {
  const cancel = useMutation(api.paymentRequests.cancel);
  const errorId = useId();
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [canShareQr, setCanShareQr] = useState(false);
  const [payUrl, setPayUrl] = useState(`/pay/${publicId}`);
  const payPath = `/pay/${publicId}`;
  const qrRef = useRef<SVGSVGElement>(null);
  const shareFileRef = useRef<File | null>(null);
  const sharingRef = useRef(false);
  const expiresLabel = request.expiresAt != null ? formatDisplayDateTime(request.expiresAt) : null;

  useEffect(() => {
    setPayUrl(`${window.location.origin}${payPath}`);
  }, [payPath]);

  useEffect(() => {
    const svg = qrRef.current;
    if (
      !svg ||
      !payUrl.startsWith("http") ||
      typeof navigator.share !== "function" ||
      typeof navigator.canShare !== "function"
    ) {
      return;
    }

    let cancelled = false;
    void paymentQrToPngFile(svg)
      .then((file) => {
        if (cancelled) return;
        const payload: ShareData = { text: payUrl, files: [file] };
        if (!navigator.canShare(payload)) return;
        shareFileRef.current = file;
        setCanShareQr(true);
      })
      .catch(() => {
        if (!cancelled) setCanShareQr(false);
      });

    return () => {
      cancelled = true;
    };
  }, [payUrl]);

  async function onCancel() {
    setBusy(true);
    setError(null);
    try {
      await cancel({ publicId });
      setConfirmCancel(false);
    } catch (e) {
      setError(userFacingError(e, "Unable to cancel request. Try again."));
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(payUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Could not copy the link. Select it and copy it manually.");
    }
  }

  async function shareLink() {
    const file = shareFileRef.current;
    if (!file || sharingRef.current) return;
    sharingRef.current = true;
    setError(null);
    try {
      await navigator.share({ text: payUrl, files: [file] });
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        setError("Could not share the payment link. Copy it instead.");
      }
    } finally {
      sharingRef.current = false;
    }
  }

  return (
    <div className="pr-page pr-page--measure">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="pr-display pr-money text-3xl">
            ${formatUsdFromMicros(request.amountUsdMicros)}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {formatTokenAmount(request.outputAmountBaseUnits, request.destinationTokenDecimals)}{" "}
            {request.destinationTokenSymbol}
          </p>
        </div>
        <StatusBadge status={request.status} />
      </div>

      <dl className="space-y-1 text-sm">
        {request.description ? (
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Note</dt>
            <dd className="text-right text-foreground">{request.description}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Expires</dt>
          <dd className="text-right text-foreground">
            {expiresLabel ?? "Stays open until paid or cancelled"}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Paid to</dt>
          <dd className="pr-mono text-right text-foreground">{request.recipientAddress}</dd>
        </div>
      </dl>

      <div className="pr-panel pr-panel--padded space-y-4">
        <p className="pr-kicker">Payment link</p>
        <PaymentQr ref={qrRef} value={payUrl} />
        <InputGroup>
          <InputGroupInput
            readOnly
            value={payUrl}
            aria-label="Public payment URL"
            className="pr-mono"
            onFocus={(e) => e.currentTarget.select()}
          />
          <InputGroupAddon>
            {canShareQr ? (
              <InputGroupButton aria-label="Share payment link" onClick={() => void shareLink()}>
                <Share className="size-4" strokeWidth={1.5} />
              </InputGroupButton>
            ) : null}
            <InputGroupButton
              aria-label={copied ? "Copied" : "Copy payment link"}
              onClick={() => void copyLink()}
            >
              {copied ? (
                <Check className="size-4" strokeWidth={1.5} />
              ) : (
                <Copy className="size-4" strokeWidth={1.5} />
              )}
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href={`/pay/${publicId}`} target="_blank" rel="noopener noreferrer">Open pay page</Link>
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

      <p className="text-xs text-muted">
        Settlement is checked on the server about once a minute. This page does not mark the request
        paid by itself. The address above is the one saved when the request was created.
      </p>

      {attempts.length > 0 && (
        <div className="space-y-2">
          <h2 className="pr-section-title">Payment attempts</h2>
          <ul className="space-y-2">
            {attempts.map((a) => (
              <li
                key={a._id}
                className="pr-inset flex items-center justify-between gap-3 px-3 py-2 text-xs text-muted"
              >
                <span className="pr-mono min-w-0 truncate">
                  {a.depositTxnRef ? a.depositTxnRef.slice(0, 10) + "…" : "—"}
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
