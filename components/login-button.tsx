"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { shortenAddress } from "@/lib/utils";

export function LoginButton() {
  const { ready, authenticated, login } = usePrivy();
  const { address } = useAccount();

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
