"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useHlAccount } from "@/components/trade/use-hyperliquid";
import { HYPERCORE_USDC } from "@/lib/hyperliquid/config";
import { formatUsd } from "@/lib/hyperliquid/math";
import { useSignedInWallet } from "@/lib/use-signed-in-wallet";
import { cn } from "@/lib/utils";

/** Compact Hyperliquid balance. Tapping it opens the portfolio. */
export function BalanceCard({
  className,
  onNavigate,
}: {
  className?: string;
  onNavigate?: () => void;
}) {
  const { isSignedIn, address } = useSignedInWallet();
  const { data, isError } = useHlAccount(address);
  if (!isSignedIn) return null;

  const pnl = data?.unrealizedPnl ?? 0;
  const open = data?.positions.length ?? 0;
  const caption = isError
    ? "Balance unavailable"
    : !data
      ? "Loading…"
      : open > 0
        ? `${formatUsd(pnl, { sign: true })} across ${open} position${open === 1 ? "" : "s"}`
        : "Hyperliquid · ready to trade";

  return (
    <Link
      href="/portfolio"
      onClick={onNavigate}
      aria-label={`Portfolio, balance ${data ? formatUsd(data.equity) : "loading"}`}
      className={cn(
        "pr-inset pr-inset--accent flex items-start gap-2.5 px-3 py-3 text-start no-underline transition-colors hover:bg-foreground/5 active:bg-foreground/10",
        className,
      )}
    >
      <span className="relative mbs-0.5 shrink-0">
        <Image
          src={HYPERCORE_USDC.logoUrl}
          alt=""
          width={28}
          height={28}
          className="size-7 rounded-full ring-1 ring-border"
          unoptimized
        />
        <Image
          src={HYPERCORE_USDC.chainLogoUrl}
          alt=""
          width={14}
          height={14}
          className="absolute -inset-be-0.5 -inset-e-0.5 size-3.5 rounded-full ring-2 ring-[var(--panel-elevated)]"
          unoptimized
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="pr-kicker block">{HYPERCORE_USDC.symbol}</span>
        <span className="pr-money mbs-1 block truncate text-xl leading-none font-semibold tracking-tight text-foreground">
          {data ? formatUsd(data.equity) : isError ? "—" : "…"}
        </span>
        <span
          className={cn(
            "mbs-1.5 block truncate text-xs",
            open > 0 ? (pnl >= 0 ? "text-success" : "text-danger") : "text-muted",
          )}
        >
          {caption}
        </span>
      </span>
      <ChevronRight className="mbs-0.5 size-4 shrink-0 text-muted" strokeWidth={1.5} aria-hidden />
    </Link>
  );
}
