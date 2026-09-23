"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useAccount, useSignMessage } from "wagmi";
import { api } from "@/convex/_generated/api";
import { walletClaimMessage } from "@/convex/lib/walletClaim";
import { useAppAuth } from "@/lib/auth-bridge";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";

export function ClaimWalletButton() {
  const { ready, authenticated, email } = useAppAuth();
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const issueNonce = useMutation(api.users.issueNonce);
  const storeUser = useMutation(api.users.store);
  const me = useQuery(api.users.me, ready && authenticated ? {} : "skip");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!ready || !authenticated || !address) return null;
  if (me && me.address.toLowerCase() === address.toLowerCase()) return null;

  async function onClaim() {
    if (!address) return;
    setBusy(true);
    setError(null);
    try {
      const nonce = await issueNonce({});
      const signature = await signMessageAsync({ message: walletClaimMessage(nonce) });
      await storeUser({
        address,
        nonce,
        signature,
        ...(email ? { email } : {}),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not confirm this wallet");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button type="button" className="w-full" disabled={busy} onClick={() => void onClaim()}>
        {busy ? "Confirming wallet…" : "Confirm wallet"}
      </Button>
      <p className="text-xs text-muted">
        Payrequest stores this address only after your wallet signs a one-time claim.
      </p>
      <FieldError id="claim-wallet-error" message={error} />
    </div>
  );
}
