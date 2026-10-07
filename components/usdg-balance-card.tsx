"use client";

import Image from "next/image";
import { ChevronDown, Sprout, Wallet } from "lucide-react";
import { useId, useState } from "react";
import { useReadContract } from "wagmi";
import { erc20Abi, type Address } from "viem";
import { ROBINHOOD_USDG } from "@/lib/destination";
import { formatTokenAmountGrouped } from "@/lib/money";
import { useSignedInWallet } from "@/lib/use-signed-in-wallet";
import { VAULT_ADDRESS, vaultAbi } from "@/lib/vault-calls";
import { cn } from "@/lib/utils";

type UsdgBalanceCardProps = {
  className?: string;
};

function balanceLabel(value: bigint | undefined, connected: boolean, error: boolean): string {
  if (!connected || error) return "—";
  if (value === undefined) return "…";
  return formatTokenAmountGrouped(value.toString(), ROBINHOOD_USDG.decimals);
}

function useUsdgBalances() {
  const { address, isConnected } = useSignedInWallet();
  const connected = isConnected && Boolean(address);
  const walletRead = useReadContract({
    address: ROBINHOOD_USDG.address as Address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: ROBINHOOD_USDG.chainId,
    query: { enabled: connected, refetchInterval: 30_000 },
  });
  const sharesRead = useReadContract({
    address: VAULT_ADDRESS,
    abi: vaultAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: ROBINHOOD_USDG.chainId,
    query: { enabled: connected, refetchInterval: 30_000 },
  });
  const assetsRead = useReadContract({
    address: VAULT_ADDRESS,
    abi: vaultAbi,
    functionName: "convertToAssets",
    args: sharesRead.data !== undefined ? [sharesRead.data] : undefined,
    chainId: ROBINHOOD_USDG.chainId,
    query: {
      enabled:
        connected && !sharesRead.isError && sharesRead.data !== undefined && sharesRead.data > 0n,
      refetchInterval: 30_000,
    },
  });
  return formatBalances(walletRead, sharesRead, assetsRead, connected);
}

type BalanceRead = { data: bigint | undefined; isError: boolean };

function formatBalances(
  walletRead: BalanceRead,
  sharesRead: BalanceRead,
  assetsRead: BalanceRead,
  connected: boolean,
) {
  const vaultAssets = sharesRead.data === 0n ? 0n : assetsRead.data;
  const vaultError = sharesRead.isError || (sharesRead.data !== 0n && assetsRead.isError);
  const totalError = walletRead.isError || vaultError;
  const total =
    walletRead.data !== undefined && sharesRead.data !== undefined && vaultAssets !== undefined
      ? walletRead.data + vaultAssets
      : undefined;

  return {
    totalLabel: balanceLabel(total, connected, totalError),
    walletLabel: balanceLabel(walletRead.data, connected, walletRead.isError),
    vaultLabel: balanceLabel(
      sharesRead.data === undefined ? undefined : vaultAssets,
      connected,
      vaultError,
    ),
    caption: !connected
      ? "Connect to view balance"
      : totalError
        ? "Balance unavailable"
        : "Wallet + vault",
  };
}

export function UsdgBalanceCard({ className }: UsdgBalanceCardProps) {
  const balances = useUsdgBalances();
  const [expanded, setExpanded] = useState(false);
  const breakdownId = useId();

  return (
    <div className={cn("pr-inset pr-inset--accent", className)}>
      <button
        type="button"
        className="flex w-full items-start gap-2.5 rounded-[inherit] px-3 py-3 text-start transition-colors hover:bg-foreground/5 active:bg-foreground/10"
        aria-expanded={expanded}
        aria-controls={breakdownId}
        aria-label={expanded ? "Hide USDG balance breakdown" : "Show USDG balance breakdown"}
        onClick={() => setExpanded((value) => !value)}
      >
        <Image
          src={ROBINHOOD_USDG.logoUrl}
          alt=""
          width={28}
          height={28}
          className="mbs-0.5 size-7 shrink-0 rounded-full ring-1 ring-border"
          unoptimized
        />
        <span className="min-w-0 flex-1">
          <span className="pr-kicker block">{ROBINHOOD_USDG.symbol}</span>
          <span
            className="pr-money mbs-1 block truncate text-xl font-semibold leading-none tracking-tight text-foreground"
            aria-live="polite"
          >
            {balances.totalLabel}
          </span>
          <span className="mbs-1.5 block text-xs text-muted">{balances.caption}</span>
        </span>
        <ChevronDown
          className={cn("mbs-0.5 size-3.5 shrink-0 text-muted", expanded && "rotate-180")}
          strokeWidth={1.5}
          aria-hidden
        />
      </button>
      <div id={breakdownId} hidden={!expanded} className="mx-3 border-bs border-border pbe-3 pbs-3">
        <dl className="space-y-3 text-xs">
          <div className="flex items-start gap-2">
            <Wallet
              className="mbs-0.5 size-3.5 shrink-0 text-muted"
              strokeWidth={1.5}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <dt className="font-medium text-foreground">Wallet USDG</dt>
              <dd className="mbs-0.5 text-muted">Available to send</dd>
              <dd
                className="pr-money mbs-1 break-all text-sm font-semibold text-foreground"
                aria-live="polite"
              >
                {balances.walletLabel}
                <span className="ms-1 text-xs font-normal text-muted">USDG</span>
              </dd>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Sprout
              className="mbs-0.5 size-3.5 shrink-0 text-muted"
              strokeWidth={1.5}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <dt className="font-medium text-foreground">Steakhouse vault</dt>
              <dd className="mbs-0.5 text-muted">Deposited · includes yield</dd>
              <dd
                className="pr-money mbs-1 break-all text-sm font-semibold text-foreground"
                aria-live="polite"
              >
                {balances.vaultLabel}
                <span className="ms-1 text-xs font-normal text-muted">USDG</span>
              </dd>
            </div>
          </div>
        </dl>
        <p className="mbs-3 text-[11px] text-muted">Robinhood Chain</p>
      </div>
    </div>
  );
}
