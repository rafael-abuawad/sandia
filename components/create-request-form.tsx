"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { LoginButton } from "@/components/login-button";
import { useSignedInWallet } from "@/lib/use-signed-in-wallet";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AmountCompose } from "@/components/amount-compose";
import { isAmountEntered } from "@/lib/amount-entered";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/responsive-dialog";
import { ROBINHOOD_USDG } from "@/lib/destination";
import { parseUsdToMicros } from "@/lib/money";
import { userFacingError } from "@/lib/user-facing-error";

function detailsHint(note: string, expiresAtLocal: string): string | undefined {
  const parts: string[] = [];
  if (note.trim()) parts.push(note.trim());
  if (expiresAtLocal) {
    const parsed = new Date(expiresAtLocal);
    if (!Number.isNaN(parsed.getTime())) {
      parts.push(`Expires ${parsed.toLocaleString()}`);
    }
  }
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

export function CreateRequestForm({
  initialAmount = "",
  embeddedPresentation = false,
  onPendingChange,
}: {
  initialAmount?: string;
  embeddedPresentation?: boolean;
  onPendingChange?: (pending: boolean) => void;
}) {
  const router = useRouter();
  const { isSignedIn } = useSignedInWallet();
  const createRequest = useMutation(api.paymentRequests.create);
  const errorId = useId();
  const amountRefId = useId();
  const expiresRef = useRef<HTMLInputElement>(null);

  const [amount, setAmount] = useState(initialAmount);
  const [description, setDescription] = useState("");
  const [expiresAtLocal, setExpiresAtLocal] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invalidField, setInvalidField] = useState<"amount" | "expires" | null>(null);

  useEffect(() => {
    if (invalidField === "expires") expiresRef.current?.focus();
  }, [invalidField]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInvalidField(null);

    if (!isSignedIn) {
      setError("Sign in to create a request");
      return;
    }
    if (!amount.trim() || !isAmountEntered(amount)) {
      setError("Enter an amount in USD");
      setInvalidField("amount");
      return;
    }
    try {
      parseUsdToMicros(amount);
    } catch {
      setError("Enter a valid USD amount (for example 10.00)");
      setInvalidField("amount");
      return;
    }

    setSubmitting(true);
    onPendingChange?.(true);
    try {
      const amountUsdMicros = parseUsdToMicros(amount);
      const expiresAt = expiresAtLocal ? new Date(expiresAtLocal).getTime() : undefined;
      if (expiresAt !== undefined && Number.isNaN(expiresAt)) {
        setError("Choose a valid expiration date and time");
        setInvalidField("expires");
        setDetailsOpen(true);
        setSubmitting(false);
        onPendingChange?.(false);
        return;
      }

      const result = await createRequest({
        amountUsdMicros,
        destinationTokenSymbol: ROBINHOOD_USDG.symbol,
        destinationTokenAddress: ROBINHOOD_USDG.address,
        destinationTokenDecimals: ROBINHOOD_USDG.decimals,
        description: description || undefined,
        expiresAt,
      });
      router.push(`/requests/${result.publicId}`);
    } catch (err) {
      setError(userFacingError(err, "Unable to create request. Try again."));
    } finally {
      setSubmitting(false);
      onPendingChange?.(false);
    }
  }

  const hasAmount = isAmountEntered(amount);

  return (
    <form onSubmit={onSubmit} className="space-y-3" noValidate>
      <AmountCompose
        kicker="You're requesting"
        value={amount}
        onChange={setAmount}
        inputId={amountRefId}
        invalid={invalidField === "amount"}
        detailsLabel="Details"
        detailsHint={detailsHint(description, expiresAtLocal)}
        onDetailsClick={() => setDetailsOpen(true)}
        error={<FieldError id={errorId} message={error} />}
        footer={
          !isSignedIn ? (
            <div className="flex flex-col items-stretch gap-3">
              <p className="text-sm text-muted">Sign in with email to create a request.</p>
              <LoginButton />
            </div>
          ) : (
            <Button type="submit" className="w-full" size="lg" disabled={submitting || !hasAmount}>
              {submitting ? "Creating…" : hasAmount ? "Create request" : "Enter an amount"}
            </Button>
          )
        }
      />

      {embeddedPresentation ? (
        detailsOpen ? (
          <div className="space-y-4 rounded-lg border border-border p-4">
            <p className="pr-display text-base">Request details</p>
            <p className="text-sm text-muted">
              Optional note and expiration. The request settles to your connected wallet as USDG on
              Robinhood Chain.
            </p>
            <div className="space-y-2">
              <Label htmlFor="note">Note</Label>
              <Textarea
                id="note"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What's this for?"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expires">Expires</Label>
              <Input
                ref={expiresRef}
                id="expires"
                type="datetime-local"
                value={expiresAtLocal}
                onChange={(e) => setExpiresAtLocal(e.target.value)}
                aria-invalid={invalidField === "expires" || undefined}
              />
            </div>
            <Button type="button" variant="secondary" onClick={() => setDetailsOpen(false)}>
              Done
            </Button>
          </div>
        ) : null
      ) : (
        <ResponsiveDialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <ResponsiveDialogContent>
            <ResponsiveDialogHeader>
              <ResponsiveDialogTitle>Request details</ResponsiveDialogTitle>
              <ResponsiveDialogDescription>
                Optional note and expiration. Funds always settle to your connected wallet as USDG
                on Robinhood Chain.
              </ResponsiveDialogDescription>
            </ResponsiveDialogHeader>
            <ResponsiveDialogBody className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="note">Note</Label>
                <Textarea
                  id="note"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What's this for?"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expires">Expires</Label>
                <Input
                  ref={expiresRef}
                  id="expires"
                  type="datetime-local"
                  value={expiresAtLocal}
                  onChange={(e) => setExpiresAtLocal(e.target.value)}
                  aria-invalid={invalidField === "expires" || undefined}
                />
                <p className="text-xs text-muted">
                  Leave this blank and the request stays open until it is paid or cancelled.
                </p>
              </div>
            </ResponsiveDialogBody>
            <ResponsiveDialogFooter>
              <Button
                type="button"
                className="w-full sm:w-auto"
                onClick={() => setDetailsOpen(false)}
              >
                Done
              </Button>
            </ResponsiveDialogFooter>
          </ResponsiveDialogContent>
        </ResponsiveDialog>
      )}
    </form>
  );
}
