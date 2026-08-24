"use client";

import { useMemo, useState } from "react";
import { LoginButton } from "@/components/login-button";
import { useSignedInWallet } from "@/lib/use-signed-in-wallet";
import { erc20Abi, type Address } from "viem";
import { useReadContract } from "wagmi";
import { ROBINHOOD_USDG } from "@/lib/destination";
import { formatTokenAmount, formatTokenAmountGrouped } from "@/lib/money";
import { TokenChainChip } from "@/components/token-chain-select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AmountCompose, isAmountEntered } from "@/components/amount-compose";

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
  const { address, isSignedIn } = useSignedInWallet();
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
  const hasAmount = isAmountEntered(amount);

  return (
    <div className="pr-page">
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
          <dt className="pr-kicker">Deposits</dt>
          <dd className="pr-mono text-sm font-semibold text-foreground">{VAULT.totalDeposits}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 sm:block sm:space-y-1">
          <dt className="pr-kicker">Liquidity</dt>
          <dd className="pr-mono text-sm font-semibold text-foreground">{VAULT.liquidity}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 sm:block sm:space-y-1">
          <dt className="pr-kicker">Net APY</dt>
          <dd className="pr-mono text-sm font-semibold text-foreground">
            {VAULT.netApy.toFixed(2)}%
          </dd>
        </div>
      </dl>

      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
        }}
      >
        <AmountCompose
          kicker="You're depositing"
          prefix="$"
          suffix="USDG"
          value={amount}
          onChange={setAmount}
          footer={
            !isSignedIn ? (
              <div className="flex flex-col items-stretch gap-3">
                <p className="text-sm text-muted">Sign in to deposit into the vault.</p>
                <LoginButton />
              </div>
            ) : (
              <div className="space-y-2">
                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled
                  title="Vault deposit contract wiring coming next"
                >
                  {hasAmount ? "Deposit (coming soon)" : "Enter an amount"}
                </Button>
                <p className="text-center text-xs text-muted">
                  Preview — deposits are not open yet.
                </p>
              </div>
            )
          }
        >
          <div className="flex items-center justify-between gap-2 text-xs text-muted">
            <p>
              ≈ {formatUsdFromAmount(amount)}
              {amount.trim() ? ` · ~${yearly}/yr at ${VAULT.netApy}%` : null}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={setMax}
              disabled={!isSignedIn || balanceLoading || !balanceExact}
            >
              Max
            </Button>
          </div>
          <p className="pr-mono text-xs text-muted">
            Available:{" "}
            {!isSignedIn
              ? "—"
              : balanceLoading
                ? "…"
                : balanceDisplay
                  ? `${balanceDisplay} ${ROBINHOOD_USDG.symbol}`
                  : `0 ${ROBINHOOD_USDG.symbol}`}
          </p>
          <div className="space-y-2">
            <Label>Vault</Label>
            <TokenChainChip
              tokenSymbol={ROBINHOOD_USDG.symbol}
              tokenLogoUrl={ROBINHOOD_USDG.logoUrl}
              chainName={`${VAULT.curator} · ${ROBINHOOD_USDG.chainName}`}
              chainLogoUrl={ROBINHOOD_USDG.chainLogoUrl}
              chainId={ROBINHOOD_USDG.chainId}
            />
          </div>
        </AmountCompose>
      </form>
    </div>
  );
}
