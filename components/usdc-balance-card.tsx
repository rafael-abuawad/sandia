"use client";

import Image from "next/image";
import { formatTokenAmountGrouped } from "@/lib/money";
import { STELLAR_USDC } from "@/lib/stellar/constants";
import { useStellarAccount } from "@/lib/stellar/use-account";
import { useSignedInWallet } from "@/lib/use-signed-in-wallet";
import { cn } from "@/lib/utils";

type UsdcBalanceCardProps = {
  className?: string;
};

function balanceLabel(value: bigint | undefined, connected: boolean, error: boolean): string {
  if (!connected || error) return "—";
  if (value === undefined) return "…";
  return formatTokenAmountGrouped(value.toString(), STELLAR_USDC.decimals);
}

export function UsdcBalanceCard({ className }: UsdcBalanceCardProps) {
  const { address, isConnected } = useSignedInWallet();
  const connected = isConnected && Boolean(address);
  const wallet = useStellarAccount(address);
  const caption = !connected
    ? "Connect to view balance"
    : wallet.isError
      ? "Balance unavailable"
      : "Available to send";

  return (
    <div className={cn("pr-inset pr-inset--accent", className)}>
      <div className="flex items-start gap-2.5 px-3 py-3">
        <Image
          src={STELLAR_USDC.logoUrl}
          alt=""
          width={28}
          height={28}
          className="mbs-0.5 size-7 shrink-0 rounded-full ring-1 ring-border"
          unoptimized
        />
        <div className="min-w-0 flex-1">
          <span className="pr-kicker block">{STELLAR_USDC.symbol}</span>
          <span
            className="pr-money mbs-1 block truncate text-xl font-semibold leading-none tracking-tight text-foreground"
            aria-live="polite"
          >
            {balanceLabel(wallet.data?.usdcBalance, connected, wallet.isError)}
          </span>
          <span className="mbs-1.5 block text-xs text-muted">{caption}</span>
        </div>
      </div>
    </div>
  );
}
