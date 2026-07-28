"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { ConnectKitButton } from "connectkit";
import { useMutation } from "convex/react";
import { isAddress } from "viem";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TokenChainChip } from "@/components/token-chain-select";
import { ROBINHOOD_USDG } from "@/lib/destination";
import { parseUsdToMicros } from "@/lib/money";

export function CreateRequestForm() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const createRequest = useMutation(api.paymentRequests.create);

  const [amount, setAmount] = useState("10");
  const [recipient, setRecipient] = useState("");
  const [description, setDescription] = useState("");
  const [expiresAtLocal, setExpiresAtLocal] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (address) {
      setRecipient((prev) => (prev ? prev : address));
    }
  }, [address]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isConnected || !address) {
      setError("Connect a wallet to create a request");
      return;
    }
    if (!isAddress(recipient)) {
      setError("Enter a valid recipient address");
      return;
    }

    setSubmitting(true);
    try {
      const amountUsdMicros = parseUsdToMicros(amount);
      const expiresAt = expiresAtLocal ? new Date(expiresAtLocal).getTime() : undefined;
      if (expiresAt !== undefined && Number.isNaN(expiresAt)) {
        throw new Error("Invalid expiration date");
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
      setError(err instanceof Error ? err.message : "Failed to create request");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-lg space-y-5">
      <div className="space-y-2">
        <Label htmlFor="amount">Amount (USD)</Label>
        <Input
          id="amount"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="10.00"
          required
        />
        <p className="pr-help">Settled 1:1 as USDG on Robinhood Chain via Across.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="recipient">Recipient wallet</Label>
        <Input
          id="recipient"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="0x…"
          required
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
        <p className="pr-help">
          Across currently settles payment requests as USDG on Robinhood Chain.
        </p>
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
          id="expires"
          type="datetime-local"
          value={expiresAtLocal}
          onChange={(e) => setExpiresAtLocal(e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

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
    </form>
  );
}
