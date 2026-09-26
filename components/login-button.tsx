"use client";

import { Button } from "@/components/ui/button";
import { shortenAddress } from "@/lib/utils";
import { useAppAuth } from "@/lib/auth-bridge";
import { useSignedInWallet } from "@/lib/use-signed-in-wallet";

export function LoginButton() {
  const { login } = useAppAuth();
  const { ready, authenticated, address } = useSignedInWallet();

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
