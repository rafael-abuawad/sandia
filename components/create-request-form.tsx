"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { ConnectKitButton } from "connectkit";
import { useMutation } from "convex/react";
import { isAddress } from "viem";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TokenChainChip } from "@/components/token-chain-select";
import { ROBINHOOD_USDG } from "@/lib/destination";
import { parseUsdToMicros } from "@/lib/money";

export function CreateRequestForm() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const createRequest = useMutation(api.paymentRequests.create);
  const errorId = useId();
  const amountRef = useRef<HTMLInputElement>(null);
  const recipientRef = useRef<HTMLInputElement>(null);
  const expiresRef = useRef<HTMLInputElement>(null);

  const [amount, setAmount] = useState("10");
  const [recipient, setRecipient] = useState("");
  const [description, setDescription] = useState("");
  const [expiresAtLocal, setExpiresAtLocal] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invalidField, setInvalidField] = useState<"amount" | "recipient" | "expires" | null>(null);

  useEffect(() => {
    if (address) {
      setRecipient((prev) => (prev ? prev : address));
    }
  }, [address]);

  useEffect(() => {
    if (invalidField === "amount") amountRef.current?.focus();
    if (invalidField === "recipient") recipientRef.current?.focus();
    if (invalidField === "expires") expiresRef.current?.focus();
  }, [invalidField]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInvalidField(null);

    if (!isConnected || !address) {
      setError("Connect a wallet to create a request");
      return;
    }
    if (!amount.trim()) {
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
    if (!isAddress(recipient)) {
      setError("Enter a valid recipient address");
      setInvalidField("recipient");
      return;
    }

    setSubmitting(true);
    try {
      const amountUsdMicros = parseUsdToMicros(amount);
      const expiresAt = expiresAtLocal ? new Date(expiresAtLocal).getTime() : undefined;
      if (expiresAt !== undefined && Number.isNaN(expiresAt)) {
        setError("Choose a valid expiration date and time");
        setInvalidField("expires");
        setSubmitting(false);
        return;
      }

      const result = await createRequest({
        creatorAddress: address,
        amountUsdMicros,
        recipientAddress: recipient,
        destinationTokenSymbol: ROBINHOOD_USDG.symbol,
        destinationTokenAddress: ROBINHOOD_USDG.address,
        destinationTokenDecimals: ROBINHOOD_USDG.decimals,
        description: description || undefined,
        expiresAt,
      });
      router.push(`/requests/${result.publicId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create request. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div className="space-y-2">
        <Label htmlFor="amount">Amount (USD)</Label>
        <Input
          ref={amountRef}
          id="amount"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="10.00"
          required
          aria-invalid={invalidField === "amount" || undefined}
          aria-describedby={error && invalidField === "amount" ? errorId : "amount-help"}
        />
        <p id="amount-help" className="pr-help">
          Settled 1:1 as USDG on Robinhood Chain. Payers bridge from their own chain.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="recipient">Recipient wallet</Label>
        <Input
          ref={recipientRef}
          id="recipient"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="0x…"
          required
          aria-invalid={invalidField === "recipient" || undefined}
          aria-describedby={error && invalidField === "recipient" ? errorId : undefined}
        />
      </div>

      <div className="space-y-2">
        <Label>Destination</Label>
        <TokenChainChip
          tokenSymbol={ROBINHOOD_USDG.symbol}
          tokenLogoUrl={ROBINHOOD_USDG.logoUrl}
          chainName={ROBINHOOD_USDG.chainName}
          chainLogoUrl={ROBINHOOD_USDG.chainLogoUrl}
        />
        <p className="pr-help">Payment requests settle as USDG on Robinhood Chain.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Input
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Invoice #1042"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="expires">Expires (optional)</Label>
        <Input
          ref={expiresRef}
          id="expires"
          type="datetime-local"
          value={expiresAtLocal}
          onChange={(e) => setExpiresAtLocal(e.target.value)}
          aria-invalid={invalidField === "expires" || undefined}
          aria-describedby={error && invalidField === "expires" ? errorId : undefined}
        />
      </div>

      <FieldError id={errorId} message={error} />

      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 -mx-1 bg-[color-mix(in_srgb,var(--background)_92%,transparent)] px-1 py-3 backdrop-blur-sm md:static md:bottom-auto md:bg-transparent md:p-0 md:backdrop-blur-none">
        {!isConnected ? (
          <div className="flex flex-col items-stretch gap-3">
            <p className="text-sm text-muted">
              Connect a wallet to create a request. No message signature required.
            </p>
            <ConnectKitButton />
          </div>
        ) : (
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Creating…" : "Create payment request"}
          </Button>
        )}
      </div>
    </form>
  );
}
