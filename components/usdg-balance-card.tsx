"use client";

import Image from "next/image";
import { useReadContract } from "wagmi";
import { erc20Abi, type Address } from "viem";
import { ROBINHOOD_USDG } from "@/lib/destination";
import { formatTokenAmountGrouped } from "@/lib/money";
import { useSignedInWallet } from "@/lib/use-signed-in-wallet";
import { cn } from "@/lib/utils";

type UsdgBalanceCardProps = {
  className?: string;
};

export function UsdgBalanceCard({ className }: UsdgBalanceCardProps) {
  const { address, isConnected } = useSignedInWallet();
  const { data, isLoading, isError } = useReadContract({
    address: ROBINHOOD_USDG.address as Address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: ROBINHOOD_USDG.chainId,
    query: {
      enabled: Boolean(address),
      refetchInterval: 30_000,
    },
  });

  const formatted =
    data !== undefined ? formatTokenAmountGrouped(data.toString(), ROBINHOOD_USDG.decimals) : null;

  return (
    <div className={cn("pr-inset pr-inset--accent px-3 py-3", className)}>
      <div className="flex items-start gap-2.5">
        <Image
          src={ROBINHOOD_USDG.logoUrl}
          alt=""
          width={28}
          height={28}
          className="mt-0.5 size-7 shrink-0 rounded-full ring-1 ring-border"
          unoptimized
        />
        <div className="min-w-0 flex-1">
          <p className="pr-kicker">{ROBINHOOD_USDG.symbol}</p>
          <p
            className="pr-money mt-1 truncate text-xl font-semibold leading-none tracking-tight text-foreground"
            aria-live="polite"
          >
            {!isConnected ? "—" : isLoading ? "…" : isError || formatted === null ? "—" : formatted}
          </p>
          <p className="mt-1.5 text-xs text-muted">
            {isConnected ? "Robinhood Chain" : "Connect to view balance"}
          </p>
        </div>
      </div>
    </div>
  );
}
