"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
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
    return <WalletAddress address={address} />;
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

function WalletAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.error("wallet_address_copy_failed", {
        message: error instanceof Error ? error.message : "Could not copy address",
      });
    }
  }

  return (
    <div className="relative flex h-10 w-full items-center justify-center rounded-md border border-border-strong bg-panel-elevated px-10">
      <span className="truncate pr-mono text-sm text-muted">{shortenAddress(address, 4)}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="absolute right-1 text-muted hover:text-foreground"
        aria-label={copied ? "Address copied" : "Copy address"}
        onClick={() => void copyAddress()}
      >
        {copied ? (
          <Check className="size-4" strokeWidth={1.5} aria-hidden />
        ) : (
          <Copy className="size-4" strokeWidth={1.5} aria-hidden />
        )}
      </Button>
      <span className="sr-only" aria-live="polite">
        {copied ? "Address copied" : ""}
      </span>
    </div>
  );
}
