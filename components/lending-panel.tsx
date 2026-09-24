"use client";

import { useEffect, useMemo, useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { vaultDepositGate } from "@/lib/vault-gate";
import { LoginButton } from "@/components/login-button";
import { useSignedInWallet } from "@/lib/use-signed-in-wallet";
import { erc20Abi, type Address } from "viem";
import { useReadContract } from "wagmi";
import { ROBINHOOD_USDG } from "@/lib/destination";
import { formatTokenAmount, formatTokenAmountGrouped } from "@/lib/money";
import { TokenChainChip } from "@/components/token-chain-select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AmountCompose } from "@/components/amount-compose";
import { isAmountEntered } from "@/lib/amount-entered";

const VAULT = {
  name: "Steakhouse USDG",
  version: "V2",
  description:
    "Lend USDG on Robinhood Chain through the Steakhouse Morpho vault. The curator is not a custodian, and liquidity can delay an exit.",
} as const;

type VaultStats = {
  totalAssets?: string;
  maxDeposit?: string;
  shares?: string;
  assets?: string;
  assetIsUsdg: boolean;
};

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

function formatBaseUnits(value: string | undefined, decimals: number): string {
  if (!value) return "—";
  return formatTokenAmountGrouped(value, decimals);
}

function useVaultPosition(address: string | undefined) {
  const readVault = useAction(api.vault.readPosition);
  const [vaultError, setVaultError] = useState<string | null>(null);
  const [vaultStats, setVaultStats] = useState<VaultStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    void readVault(address ? { account: address } : {})
      .then((result) => {
        if (cancelled) return;
        if (!result.ok) {
          setVaultError(result.reason ?? "Vault read failed");
          setVaultStats(null);
          return;
        }
        setVaultError(null);
        setVaultStats(result);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setVaultError(error instanceof Error ? error.message : "Vault read failed");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [address, readVault]);

  return { vaultError, vaultStats };
}

export function LendingPanel() {
  const { address, isSignedIn } = useSignedInWallet();
  const { vaultError, vaultStats } = useVaultPosition(address);
  const [amount, setAmount] = useState("");

  const depositGate = vaultStats
    ? vaultDepositGate({
        asset: ROBINHOOD_USDG.address,
        usdg: ROBINHOOD_USDG.address,
        maxDeposit: BigInt(vaultStats.maxDeposit ?? "0"),
      })
    : { depositEnabled: false, reason: vaultError ?? "Reading the vault…" };
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

      <LendingStats vaultError={vaultError} vaultStats={vaultStats} />

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
            <LendingDepositFooter
              isSignedIn={isSignedIn}
              depositEnabled={depositGate.depositEnabled}
              hasAmount={isAmountEntered(amount)}
              vaultError={vaultError}
              depositReason={depositGate.reason}
            />
          }
        >
          <div className="flex items-center justify-between gap-2 text-xs text-muted">
            <p>≈ {formatUsdFromAmount(amount)}</p>
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
          <AvailableBalance
            isSignedIn={isSignedIn}
            balanceLoading={balanceLoading}
            balanceDisplay={balanceDisplay}
          />
          <div className="space-y-2">
            <Label>Vault</Label>
            <TokenChainChip
              tokenSymbol={ROBINHOOD_USDG.symbol}
              tokenLogoUrl={ROBINHOOD_USDG.logoUrl}
              chainName={`Steakhouse · ${ROBINHOOD_USDG.chainName}`}
              chainLogoUrl={ROBINHOOD_USDG.chainLogoUrl}
              chainId={ROBINHOOD_USDG.chainId}
            />
          </div>
        </AmountCompose>
      </form>
    </div>
  );
}

function LendingStats({
  vaultError,
  vaultStats,
}: {
  vaultError: string | null;
  vaultStats: VaultStats | null;
}) {
  return (
    <dl className="grid grid-cols-1 gap-4 border-y border-border py-4 sm:grid-cols-3 sm:gap-3">
      <div className="flex items-baseline justify-between gap-3 sm:block sm:space-y-1">
        <dt className="pr-kicker">Deposits</dt>
        <dd className="pr-mono text-sm font-semibold text-foreground">
          {vaultError ? "Unavailable" : `${formatBaseUnits(vaultStats?.totalAssets, 6)} USDG`}
        </dd>
      </div>
      <div className="flex items-baseline justify-between gap-3 sm:block sm:space-y-1">
        <dt className="pr-kicker">Your shares</dt>
        <dd className="pr-mono text-sm font-semibold text-foreground">
          {formatBaseUnits(vaultStats?.shares, 18)}
        </dd>
      </div>
      <div className="flex items-baseline justify-between gap-3 sm:block sm:space-y-1">
        <dt className="pr-kicker">maxDeposit</dt>
        <dd className="pr-mono text-sm font-semibold text-foreground">
          {formatBaseUnits(vaultStats?.maxDeposit, 6)}
        </dd>
      </div>
    </dl>
  );
}

function LendingDepositFooter({
  isSignedIn,
  depositEnabled,
  hasAmount,
  vaultError,
  depositReason,
}: {
  isSignedIn: boolean;
  depositEnabled: boolean;
  hasAmount: boolean;
  vaultError: string | null;
  depositReason?: string;
}) {
  if (!isSignedIn) {
    return (
      <div className="flex flex-col items-stretch gap-3">
        <p className="text-sm text-muted">Sign in to deposit into the vault.</p>
        <LoginButton />
      </div>
    );
  }

  const actionLabel = depositEnabled
    ? hasAmount
      ? "Deposit"
      : "Enter an amount"
    : "Deposit unavailable";

  return (
    <div className="space-y-2">
      <Button type="submit" className="w-full" size="lg" disabled>
        {actionLabel}
      </Button>
      <p className="text-center text-xs text-muted">
        {vaultError ?? depositReason ?? "Deposit stays disabled until maxDeposit is above zero."}{" "}
        Withdraw and redeem stay closed until a Sandia account receipt can be checked.
      </p>
      <p className="text-center text-xs text-muted">
        <a
          className="underline underline-offset-2"
          href="https://www.steakhouse.financial/docs/documents/disclaimers/vaults"
        >
          Vault disclaimers
        </a>
      </p>
    </div>
  );
}

function AvailableBalance({
  isSignedIn,
  balanceLoading,
  balanceDisplay,
}: {
  isSignedIn: boolean;
  balanceLoading: boolean;
  balanceDisplay: string | null;
}) {
  const label = !isSignedIn
    ? "—"
    : balanceLoading
      ? "…"
      : balanceDisplay
        ? `${balanceDisplay} ${ROBINHOOD_USDG.symbol}`
        : `0 ${ROBINHOOD_USDG.symbol}`;

  return <p className="pr-mono text-xs text-muted">Available: {label}</p>;
}
