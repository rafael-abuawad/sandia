"use client";

import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { shortenAddress } from "@/lib/utils";
import { sandiaAuthMode } from "@/lib/sandia-auth";
import { useAppAuth } from "@/lib/auth-bridge";
import { SandiaLoginControls } from "@/components/sandia-login";

function PrivyLoginButton() {
  const { ready, authenticated, login } = useAppAuth();
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

export function LoginButton() {
  if (sandiaAuthMode() === "zerodev") return <SandiaLoginControls />;
  return <PrivyLoginButton />;
}
