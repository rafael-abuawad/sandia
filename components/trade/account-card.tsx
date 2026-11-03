"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Check, Copy } from "lucide-react";
import { LoginButton } from "@/components/login-button";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/responsive-dialog";
import { useHlAccount } from "@/components/trade/use-hyperliquid";
import { formatUsd } from "@/lib/hyperliquid/math";
import { useSignedInWallet } from "@/lib/use-signed-in-wallet";
import { cn, shortenAddress } from "@/lib/utils";

/** Balance at the top of the app: one number, two actions. */
export function AccountCard({ className }: { className?: string }) {
  const { ready, isSignedIn, address } = useSignedInWallet();
  const { data, isLoading, isError } = useHlAccount(address);
  const [fundOpen, setFundOpen] = useState(false);

  if (!ready) {
    return (
      <section className={cn("pr-balance", className)}>
        <Skeleton className="h-4 w-20" />
        <Skeleton className="mbs-3 h-10 w-40" />
      </section>
    );
  }

  if (!isSignedIn || !address) {
    return (
      <section className={cn("pr-balance space-y-4", className)}>
        <div className="space-y-1">
          <p className="pr-kicker">Sandia</p>
          <p className="pr-display text-2xl">Trade crypto and stocks with dollars.</p>
          <p className="text-sm text-muted">
            Get paid from any chain into your Hyperliquid account.
          </p>
        </div>
        <LoginButton />
      </section>
    );
  }

  const pnl = data?.unrealizedPnl ?? 0;

  return (
    <section className={cn("pr-balance", className)} aria-label="Account balance">
      <p className="pr-kicker">Balance</p>
      {isLoading ? (
        <Skeleton className="mbs-2 h-10 w-44" />
      ) : isError || !data ? (
        <p className="mbs-2 text-sm text-muted">Balance unavailable. Retrying…</p>
      ) : (
        <div className="mbs-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <Link
            href="/portfolio"
            className="pr-money text-[2.5rem] leading-none font-semibold tracking-tight text-foreground no-underline"
            aria-label={`${formatUsd(data.equity)}, open portfolio`}
          >
            {formatUsd(data.equity)}
          </Link>
          {data.positions.length > 0 ? (
            <span
              className={cn(
                "pr-money text-sm font-semibold",
                pnl >= 0 ? "text-success" : "text-danger",
              )}
            >
              {formatUsd(pnl, { sign: true })} open
            </span>
          ) : null}
        </div>
      )}
      {data && data.positions.length > 0 ? (
        <p className="mbs-1 text-xs text-muted">{formatUsd(data.available)} available</p>
      ) : null}
      <div className="mbs-5 grid grid-cols-2 gap-2">
        <Button type="button" variant="secondary" size="lg" onClick={() => setFundOpen(true)}>
          <ArrowDownLeft className="size-4" aria-hidden /> Add funds
        </Button>
        <Button asChild variant="secondary" size="lg">
          <Link href="/send">
            <ArrowUpRight className="size-4" aria-hidden /> Send
          </Link>
        </Button>
      </div>
      <AddFundsSheet open={fundOpen} onOpenChange={setFundOpen} address={address} />
    </section>
  );
}

function AddFundsSheet({
  open,
  onOpenChange,
  address,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  address: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Add funds</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Money lands as USDC in your Hyperliquid account, ready to trade.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <ResponsiveDialogBody className="space-y-3 pbe-6">
          <Link href="/requests/new" onClick={() => onOpenChange(false)} className="pr-option">
            <span>
              <span className="block font-semibold">From any chain</span>
              <span className="block text-sm text-muted">
                Make a payment link and pay it from Base, Arbitrum, Ethereum and more.
              </span>
            </span>
          </Link>
          <button type="button" onClick={() => void copy()} className="pr-option w-full text-start">
            <span className="min-w-0">
              <span className="block font-semibold">From Hyperliquid</span>
              <span className="pr-mono block truncate text-sm text-muted">
                Send USDC to {shortenAddress(address, 6)}
              </span>
            </span>
            {copied ? (
              <Check className="size-4 shrink-0 text-success" aria-label="Copied" />
            ) : (
              <Copy className="size-4 shrink-0 text-muted" aria-label="Copy address" />
            )}
          </button>
        </ResponsiveDialogBody>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
