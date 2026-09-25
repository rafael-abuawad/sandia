"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { STEAKHOUSE_USDG_VAULT, vaultDepositGate } from "@/lib/vault-gate";
import { LoginButton } from "@/components/login-button";
import { useSignedInWallet } from "@/lib/use-signed-in-wallet";
import { erc20Abi, parseAbi, type Address } from "viem";
import { useReadContract } from "wagmi";
import { ROBINHOOD_USDG } from "@/lib/destination";
import { formatTokenAmount, formatTokenAmountGrouped } from "@/lib/money";
import {
  formatCompactUsd,
  formatNetApy,
  type ExposureRow,
  type VaultSnapshot,
} from "@/lib/morpho-vault";
import { resolveTokenIcon } from "@/lib/asset-icons";
import { TokenChainChip } from "@/components/token-chain-select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AmountCompose } from "@/components/amount-compose";
import { isAmountEntered } from "@/lib/amount-entered";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const VAULT = {
  name: "Steakhouse USDG",
  version: "V2",
  description:
    "Earn USDG on Robinhood Chain through the Steakhouse Morpho vault. The curator is not a custodian, and liquidity can delay an exit.",
} as const;

const vaultAbi = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
  "function convertToAssets(uint256 shares) view returns (uint256)",
  "function maxDeposit(address receiver) view returns (uint256)",
]);

const VAULT_ADDRESS = STEAKHOUSE_USDG_VAULT as Address;

type VaultSnapshotResult = VaultSnapshot & {
  ok: boolean;
  reason?: string;
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

function readSnapshotView(input: {
  isError: boolean;
  data: VaultSnapshotResult | undefined;
}): { snapshot: VaultSnapshot | null; error: string | undefined } {
  const data = input.data;
  const snapshot = data?.ok ? data : null;
  if (input.isError) return { snapshot, error: "Vault snapshot failed" };
  if (data && !data.ok) return { snapshot, error: data.reason };
  return { snapshot, error: undefined };
}

function resolveDepositGate(input: {
  isSignedIn: boolean;
  maxDeposit: bigint | undefined;
  maxDepositFailed: boolean;
}): { depositEnabled: boolean; reason?: string } {
  if (!input.isSignedIn) return { depositEnabled: false };
  if (input.maxDeposit === undefined) {
    return {
      depositEnabled: false,
      reason: input.maxDepositFailed
        ? "Could not read whether deposits are open"
        : "Reading the vault…",
    };
  }
  return vaultDepositGate({
    asset: ROBINHOOD_USDG.address,
    usdg: ROBINHOOD_USDG.address,
    maxDeposit: input.maxDeposit,
  });
}

function formatYourDeposit(input: {
  isSignedIn: boolean;
  failed: boolean;
  assets: bigint | undefined;
}): string {
  if (!input.isSignedIn) return "—";
  if (input.failed) return "Unavailable";
  if (input.assets === undefined) return "…";
  return `${formatTokenAmountGrouped(input.assets.toString(), ROBINHOOD_USDG.decimals)} USDG`;
}

function snapshotMetric(
  pending: boolean,
  snapshot: VaultSnapshot | null,
  format: (snapshot: VaultSnapshot) => string,
): string {
  if (pending) return "…";
  if (!snapshot) return "Unavailable";
  return format(snapshot);
}

export function EarnPanel() {
  const { address, isSignedIn } = useSignedInWallet();
  const readSnapshot = useAction(api.vault.readSnapshot);
  const snapshotQuery = useQuery({
    queryKey: ["morpho-vault-snapshot", STEAKHOUSE_USDG_VAULT],
    queryFn: () => readSnapshot({}),
    staleTime: 60_000,
    retry: 1,
  });
  const [amount, setAmount] = useState("");

  const shareRead = useReadContract({
    address: VAULT_ADDRESS,
    abi: vaultAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: ROBINHOOD_USDG.chainId,
    query: { enabled: Boolean(address), refetchInterval: 30_000 },
  });
  const assetsRead = useReadContract({
    address: VAULT_ADDRESS,
    abi: vaultAbi,
    functionName: "convertToAssets",
    args: shareRead.data !== undefined ? [shareRead.data] : undefined,
    chainId: ROBINHOOD_USDG.chainId,
    query: { enabled: shareRead.data !== undefined, refetchInterval: 30_000 },
  });
  const maxDepositRead = useReadContract({
    address: VAULT_ADDRESS,
    abi: vaultAbi,
    functionName: "maxDeposit",
    args: address ? [address] : undefined,
    chainId: ROBINHOOD_USDG.chainId,
    query: { enabled: Boolean(address), refetchInterval: 30_000 },
  });

  const { snapshot, error: snapshotError } = readSnapshotView({
    isError: snapshotQuery.isError,
    data: snapshotQuery.data,
  });
  const depositGate = resolveDepositGate({
    isSignedIn,
    maxDeposit: maxDepositRead.data,
    maxDepositFailed: maxDepositRead.isError,
  });

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

  const yourDeposit = formatYourDeposit({
    isSignedIn,
    failed: shareRead.isError || assetsRead.isError,
    assets: assetsRead.data,
  });

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

      <VaultSnapshotStats
        pending={snapshotQuery.isPending}
        snapshot={snapshot}
        error={snapshotError}
      />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="pr-kicker">Your deposit</p>
          <p className="pr-mono text-sm font-semibold text-foreground">{yourDeposit}</p>
        </div>
        <Exposure
          loading={snapshotQuery.isPending}
          rows={snapshot?.exposure ?? []}
          failed={Boolean(snapshotError)}
        />
      </div>

      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <AmountCompose
          kicker="You're depositing"
          prefix="$"
          suffix="USDG"
          value={amount}
          onChange={setAmount}
          footer={
            <EarnDepositFooter
              isSignedIn={isSignedIn}
              depositEnabled={depositGate.depositEnabled}
              hasAmount={isAmountEntered(amount)}
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
              onClick={() => {
                setAmount(balanceExact ? balanceExact : "0");
              }}
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

function VaultSnapshotStats({
  pending,
  snapshot,
  error,
}: {
  pending: boolean;
  snapshot: VaultSnapshot | null;
  error: string | undefined;
}) {
  return (
    <>
      <dl className="grid grid-cols-1 gap-4 border-y border-border py-4 sm:grid-cols-3 sm:gap-3">
        <Stat
          label="Net APY"
          value={snapshotMetric(pending, snapshot, (row) => formatNetApy(row.netApy))}
        />
        <Stat
          label="Deposits"
          value={snapshotMetric(pending, snapshot, (row) => formatCompactUsd(row.totalAssetsUsd))}
        />
        <Stat
          label="Liquidity"
          value={snapshotMetric(pending, snapshot, (row) => formatCompactUsd(row.liquidityUsd))}
        />
      </dl>
      {error ? <p className="text-xs text-muted">{error}</p> : null}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 sm:block sm:space-y-1">
      <dt className="pr-kicker">{label}</dt>
      <dd className="pr-mono text-sm font-semibold text-foreground">{value}</dd>
    </div>
  );
}

function Exposure({
  loading,
  rows,
  failed,
}: {
  loading: boolean;
  rows: ExposureRow[];
  failed: boolean;
}) {
  return (
    <div className="space-y-1">
      <p className="pr-kicker">Exposure</p>
      {loading ? (
        <p className="pr-mono text-sm font-semibold text-foreground">…</p>
      ) : failed || rows.length === 0 ? (
        <p className="pr-mono text-sm font-semibold text-foreground">
          {failed ? "Unavailable" : "—"}
        </p>
      ) : (
        <Tooltip>
          <TooltipTrigger
            type="button"
            className="flex items-center rounded-full"
            aria-label="Collateral exposure"
          >
            <span className="flex -space-x-2">
              {rows.map((row) => (
                <TokenMark key={row.symbol} symbol={row.symbol} logoUrl={row.logoUrl} />
              ))}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="w-64 px-3 py-2 text-left [text-wrap:wrap]">
            <ul className="space-y-2">
              {rows.map((row) => (
                <li key={row.symbol} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <TokenMark symbol={row.symbol} logoUrl={row.logoUrl} />
                    <span>{row.symbol}</span>
                  </span>
                  <span className="pr-mono">{formatCompactUsd(row.usd)}</span>
                </li>
              ))}
            </ul>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

function TokenMark({ symbol, logoUrl }: { symbol: string; logoUrl: string | null }) {
  const [broken, setBroken] = useState(false);
  const src = logoUrl || resolveTokenIcon(symbol);
  return (
    <span className="relative size-7 overflow-hidden rounded-full bg-panel-elevated ring-2 ring-background">
      {src && !broken ? (
        <Image
          src={src}
          alt=""
          width={28}
          height={28}
          className="size-full object-cover"
          unoptimized
          onError={() => setBroken(true)}
        />
      ) : (
        <span className="flex size-full items-center justify-center text-[9px] font-semibold uppercase text-accent-ink">
          {symbol.slice(0, 2)}
        </span>
      )}
    </span>
  );
}

function EarnDepositFooter({
  isSignedIn,
  depositEnabled,
  hasAmount,
  depositReason,
}: {
  isSignedIn: boolean;
  depositEnabled: boolean;
  hasAmount: boolean;
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
        {depositReason ?? "Deposit stays disabled until maxDeposit is above zero."} Withdraw and
        redeem stay closed until a Sandia account receipt can be checked.
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
