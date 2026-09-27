"use client";

import { Button } from "@/components/ui/button";
import { useWalletSetup } from "@/components/providers-privy";
import { shortenAddress } from "@/lib/utils";
import { useAppAuth } from "@/lib/auth-bridge";
import { useSignedInWallet } from "@/lib/use-signed-in-wallet";

export function LoginButton() {
  const { login } = useAppAuth();
  const { ready, authenticated, address } = useSignedInWallet();
  const { failed, retry } = useWalletSetup();

  if (!ready) {
    return (
      <Button type="button" className="w-full" disabled>
        Loading…
      </Button>
    );
  }

  if (authenticated && address) {
    return (
      <Button type="button" variant="secondary" className="w-full" disabled>
        {shortenAddress(address, 4)}
      </Button>
    );
  }

  if (authenticated && failed) {
    return (
      <div className="w-full space-y-2">
        <p className="text-center text-xs text-muted md:text-left">
          Wallet setup didn&apos;t finish.
        </p>
        <Button type="button" className="w-full" onClick={retry}>
          Try again
        </Button>
      </div>
    );
  }

  if (authenticated) {
    return (
      <Button type="button" className="w-full" disabled>
        Setting up wallet…
      </Button>
    );
  }

  return (
    <Button type="button" className="w-full" onClick={() => login()}>
      Sign in
    </Button>
  );
}
