"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { useLoginPasskey, useRegisterPasskey } from "@zerodev/wallet-react";
import { Button } from "@/components/ui/button";
import { shortenAddress } from "@/lib/utils";
import { passkeyRpId } from "@/lib/sandia-auth";

const projectId = process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID;

export function SandiaLoginControls() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { connect, connectors } = useConnect();
  const registerPasskey = useRegisterPasskey();
  const loginPasskey = useLoginPasskey();
  const kernel = connectors.find((connector) => connector.id.toLowerCase().includes("zero"));

  if (!projectId) {
    return (
      <p className="text-sm text-muted">
        Sandia sign-in needs NEXT_PUBLIC_ZERODEV_PROJECT_ID. This wallet is new and does not
        contain funds from an older login.
      </p>
    );
  }

  if (isConnected && address) {
    return (
      <div className="space-y-2">
        <Button type="button" variant="secondary" className="w-full" disabled>
          {shortenAddress(address, 4)}
        </Button>
        <p className="text-xs text-muted">
          This Kernel is a new wallet on Robinhood Chain. Funds on an older address stay there.
          Passkey relying party: {passkeyRpId()}.
        </p>
        <Button type="button" variant="ghost" className="w-full" onClick={() => disconnect()}>
          Log out
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        className="w-full"
        disabled={registerPasskey.isPending}
        onClick={() => registerPasskey.mutate({})}
      >
        {registerPasskey.isPending ? "Creating wallet…" : "Create wallet with passkey"}
      </Button>
      <Button
        type="button"
        variant="secondary"
        className="w-full"
        disabled={loginPasskey.isPending}
        onClick={() => loginPasskey.mutate({})}
      >
        {loginPasskey.isPending ? "Signing in…" : "Sign in with passkey"}
      </Button>
      {kernel ? (
        <Button type="button" variant="outline" className="w-full" onClick={() => connect({ connector: kernel })}>
          Resume Sandia account
        </Button>
      ) : null}
      <p className="text-xs text-muted">
        A Sandia account is a new Kernel address. It does not move funds from a previous wallet.
        Recovery uses this site&apos;s passkey ({passkeyRpId()}). Changing that host later strands
        recovery.
      </p>
    </div>
  );
}
