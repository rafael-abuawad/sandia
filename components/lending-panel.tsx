"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { ConnectKitButton } from "connectkit";
import { useAccount, useReadContract } from "wagmi";
import { erc20Abi, type Address } from "viem";
import { ROBINHOOD_USDG } from "@/lib/destination";
import { formatTokenAmount, formatTokenAmountGrouped } from "@/lib/money";
import { TokenChainChip } from "@/components/token-chain-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Placeholder vault stats until on-chain reads are wired. */
const VAULT = {
  name: "Steakhouse USDG",
  version: "V2",
  curator: "Steakhouse Financial",
  description:
    "Lend USDG on Robinhood Chain. The Steakhouse vault optimizes yield against a collateral basket.",
  netApy: 2.71,
  totalDeposits: "$209.36M",
  liquidity: "$38.45M",
} as const;

function formatUsdFromAmount(amount: string): string {
  const n = Number.parseFloat(amount.replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0) return "$0.00";
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function projectedEarnings(amount: string, apyPct: number, days: number): string {
  const n = Number.parseFloat(amount.replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0) return "$0.00";
  const earned = n * (apyPct / 100) * (days / 365);
  return earned.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function LendingPanel() {
  const { address, isConnected } = useAccount();
  const [amount, setAmount] = useState("");
  const { data: balanceValue, isLoading: balanceLoading } = useReadContract({
    address: ROBINHOOD_USDG.address as Address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: ROBINHOOD_USDG.chainId,
    query: { enabled: Boolean(address), refetchInterval: 30_000 },
  });

  const balanceExact = useMemo(() => {
    if (balanceValue === undefined) return null;
    return formatTokenAmount(balanceValue.toString(), ROBINHOOD_USDG.decimals);
  }, [balanceValue]);

  const balanceDisplay = useMemo(() => {
    if (balanceValue === undefined) return null;
    return formatTokenAmountGrouped(balanceValue.toString(), ROBINHOOD_USDG.decimals);
  }, [balanceValue]);

  function setMax() {
    if (!balanceExact) {
      setAmount("0");
      return;
    }
    setAmount(balanceExact);
  }

  const yearly = projectedEarnings(amount, VAULT.netApy, 365);

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="space-y-2">
        <div className="flex flex-wrap items-baseline gap-2">
          <h1 className="pr-display text-2xl">{VAULT.name}</h1>
          <span className="text-xs font-bold uppercase tracking-[0.16em] text-muted">
            {VAULT.version}
          </span>
        </div>
        <p className="text-sm leading-relaxed text-muted">{VAULT.description}</p>
      </div>

      <dl className="grid grid-cols-1 gap-4 border-y border-border py-4 sm:grid-cols-3 sm:gap-3">
        <div className="flex items-baseline justify-between gap-3 sm:block sm:space-y-1">
          <dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-subtle">
            Deposits
          </dt>
          <dd className="pr-mono text-sm font-semibold text-foreground">{VAULT.totalDeposits}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 sm:block sm:space-y-1">
          <dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-subtle">
            Liquidity
          </dt>
          <dd className="pr-mono text-sm font-semibold text-foreground">{VAULT.liquidity}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 sm:block sm:space-y-1">
          <dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-subtle">Net APY</dt>
          <dd className="pr-mono text-sm font-semibold text-foreground">
            {VAULT.netApy.toFixed(2)}%
          </dd>
        </div>
      </dl>

      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="lend-amount">Amount ({ROBINHOOD_USDG.symbol})</Label>
          <Input
            id="lend-amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="pr-help">
              ≈ {formatUsdFromAmount(amount)}
              {amount.trim() ? ` · ~${yearly}/yr at ${VAULT.netApy}%` : null}
            </p>
            <button
              type="button"
              onClick={setMax}
              disabled={!isConnected || balanceLoading || !balanceExact}
              className="min-h-11 min-w-11 text-xs font-semibold text-[var(--accent-ink)] disabled:opacity-50 sm:min-h-0 sm:min-w-0"
            >
              Max
            </button>
          </div>
          <p className="pr-mono text-xs text-subtle">
            Available:{" "}
            {!isConnected
              ? "—"
              : balanceLoading
                ? "…"
                : balanceDisplay
                  ? `${balanceDisplay} ${ROBINHOOD_USDG.symbol}`
                  : `0 ${ROBINHOOD_USDG.symbol}`}
          </p>
        </div>

        <div className="space-y-2">
          <Label>Vault</Label>
          <TokenChainChip
            tokenSymbol={ROBINHOOD_USDG.symbol}
            tokenLogoUrl={ROBINHOOD_USDG.logoUrl}
            chainName={`${VAULT.curator} · ${ROBINHOOD_USDG.chainName}`}
            chainLogoUrl={ROBINHOOD_USDG.chainLogoUrl}
          />
          <p className="pr-help">
            Deposits settle as {ROBINHOOD_USDG.symbol} on {ROBINHOOD_USDG.chainName} Chain.
          </p>
        </div>

        {!isConnected ? (
          <div className="flex flex-col items-stretch gap-3">
            <p className="text-sm text-muted">Connect a wallet to deposit into the vault.</p>
            <ConnectKitButton />
          </div>
        ) : (
          <Button
            type="submit"
            className="w-full"
            disabled
            title="Vault deposit contract wiring coming next"
          >
            Deposit (coming soon)
          </Button>
        )}
      </form>

      <div className="flex items-center gap-2 text-xs text-subtle">
        <Image
          src={ROBINHOOD_USDG.logoUrl}
          alt=""
          width={16}
          height={16}
          className="size-4 rounded-full"
          unoptimized
        />
        <span>
          {VAULT.curator} · {ROBINHOOD_USDG.symbol} · {ROBINHOOD_USDG.chainName}
        </span>
      </div>
    </div>
  );
}
