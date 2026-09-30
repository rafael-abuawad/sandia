"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { useAction, useMutation } from "convex/react";
import { useSendTransaction } from "@privy-io/react-auth";
import { api } from "@/convex/_generated/api";
import { STEAKHOUSE_USDG_VAULT, vaultDepositGate, vaultExitGate } from "@/lib/vault-gate";
import {
  buildVaultApprove,
  buildVaultDeposit,
  buildVaultRedeem,
  buildVaultWithdraw,
  chooseVaultExit,
  parseUsdgBaseUnits,
  VAULT_ADDRESS,
  vaultAbi,
  type VaultCall,
} from "@/lib/vault-calls";
import { TxLink } from "@/components/tx-link";
import { robinhoodChain } from "@/lib/chains";
import { sponsoredSendRequest } from "@/lib/send/sponsored";
import { shortenAddress } from "@/lib/utils";
import { userFacingError } from "@/lib/user-facing-error";
import { LoginButton } from "@/components/login-button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSignedInWallet } from "@/lib/use-signed-in-wallet";
import { erc20Abi, getAddress, type Address, type Hex } from "viem";
import { usePublicClient, useReadContract } from "wagmi";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const VAULT = {
  name: "Steakhouse USDG",
  version: "V2",
  description:
    "Earn USDG on Robinhood Chain through the Steakhouse Morpho vault. The curator is not a custodian, and liquidity can delay an exit.",
} as const;

const DEPOSIT_COPY = "Deposit USDG into the Steakhouse vault. Your shares stay in this account.";
const WITHDRAW_COPY = "Withdraw USDG from the Steakhouse vault back to this account.";
const REDEEM_COPY = "Redeem the full position. USDG comes back to this account.";
const DEPOSIT_BLOCKED = "The vault can't take this deposit right now.";
const EXIT_BLOCKED = "The vault can't return this amount right now. Try a smaller amount.";
const WALLET_SHORT = "This wallet doesn't have enough USDG on Robinhood Chain.";
const POSITION_SHORT = "This account doesn't have that much in the vault.";

type VaultMode = "deposit" | "withdraw";
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

function readSnapshotView(input: { isError: boolean; data: VaultSnapshotResult | undefined }): {
  snapshot: VaultSnapshot | null;
  error: string | undefined;
} {
  const data = input.data;
  const snapshot = data?.ok ? data : null;
  if (input.isError) return { snapshot, error: "Vault details are unavailable right now." };
  if (data && !data.ok) {
    return {
      snapshot,
      error: userFacingError(data.reason, "Vault details are unavailable right now."),
    };
  }
  return { snapshot, error: undefined };
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

function unreachable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  return /failed to fetch|network|timed out|http request/i.test(message);
}

export function EarnPanel() {
  const { ready, address, isSignedIn } = useSignedInWallet();
  const { sendTransaction } = useSendTransaction();
  const publicClient = usePublicClient({ chainId: ROBINHOOD_USDG.chainId });
  const readSnapshot = useAction(api.vault.readSnapshot);
  const recordVault = useMutation(api.vaultActivity.record);
  const confirmVault = useAction(api.vaultActivityActions.confirm);
  const snapshotQuery = useQuery({
    queryKey: ["morpho-vault-snapshot", STEAKHOUSE_USDG_VAULT],
    queryFn: () => readSnapshot({}),
    staleTime: 60_000,
    retry: 1,
  });
  const [mode, setMode] = useState<VaultMode>("deposit");
  const [amount, setAmount] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmedHash, setConfirmedHash] = useState<Hex | null>(null);

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
  const canSendAssets = useReadContract({
    address: VAULT_ADDRESS,
    abi: vaultAbi,
    functionName: "canSendAssets",
    args: address ? [address] : undefined,
    chainId: ROBINHOOD_USDG.chainId,
    query: { enabled: Boolean(address), refetchInterval: 30_000 },
  });
  const canReceiveShares = useReadContract({
    address: VAULT_ADDRESS,
    abi: vaultAbi,
    functionName: "canReceiveShares",
    args: address ? [address] : undefined,
    chainId: ROBINHOOD_USDG.chainId,
    query: { enabled: Boolean(address), refetchInterval: 30_000 },
  });
  const canSendShares = useReadContract({
    address: VAULT_ADDRESS,
    abi: vaultAbi,
    functionName: "canSendShares",
    args: address ? [address] : undefined,
    chainId: ROBINHOOD_USDG.chainId,
    query: { enabled: Boolean(address), refetchInterval: 30_000 },
  });
  const canReceiveAssets = useReadContract({
    address: VAULT_ADDRESS,
    abi: vaultAbi,
    functionName: "canReceiveAssets",
    args: address ? [address] : undefined,
    chainId: ROBINHOOD_USDG.chainId,
    query: { enabled: Boolean(address), refetchInterval: 30_000 },
  });

  const { snapshot, error: snapshotError } = readSnapshotView({
    isError: snapshotQuery.isError,
    data: snapshotQuery.data,
  });

  const {
    data: balanceValue,
    isLoading: balanceLoading,
    refetch: refetchBalance,
  } = useReadContract({
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

  const parsedAmount = useMemo(() => {
    if (!isAmountEntered(amount)) return null;
    try {
      return parseUsdgBaseUnits(amount);
    } catch {
      return null;
    }
  }, [amount]);

  const positionAssets = assetsRead.data;
  const positionShares = shareRead.data;
  const depositReadsFailed = canSendAssets.isError || canReceiveShares.isError;
  const exitReadsFailed = canSendShares.isError || canReceiveAssets.isError;
  const depositOpen =
    canSendAssets.data === undefined || canReceiveShares.data === undefined
      ? undefined
      : canSendAssets.data && canReceiveShares.data;
  const exitOpen =
    canSendShares.data === undefined || canReceiveAssets.data === undefined
      ? undefined
      : canSendShares.data && canReceiveAssets.data;

  const depositGate = !isSignedIn
    ? { enabled: false }
    : depositOpen === undefined
      ? {
          enabled: false,
          reason: depositReadsFailed
            ? "Could not read whether deposits are open"
            : "Reading the vault…",
        }
      : vaultDepositGate({
          canSendAssets: canSendAssets.data === true,
          canReceiveShares: canReceiveShares.data === true,
        });
  const exitGate = !isSignedIn
    ? { enabled: false }
    : exitOpen === undefined
      ? {
          enabled: false,
          reason: exitReadsFailed
            ? "Could not read whether withdrawals are open"
            : "Reading the vault…",
        }
      : vaultExitGate({
          canSendShares: canSendShares.data === true,
          canReceiveAssets: canReceiveAssets.data === true,
        });
  const gate = mode === "deposit" ? depositGate : exitGate;

  const exit =
    mode === "withdraw" &&
    parsedAmount !== null &&
    positionAssets !== undefined &&
    positionShares !== undefined &&
    positionAssets > 0n &&
    positionShares > 0n &&
    parsedAmount <= positionAssets
      ? chooseVaultExit({
          assets: parsedAmount,
          positionAssets,
          shares: positionShares,
        })
      : null;

  const walletShort =
    mode === "deposit" &&
    parsedAmount !== null &&
    balanceValue !== undefined &&
    parsedAmount > balanceValue;
  const positionShort =
    mode === "withdraw" &&
    parsedAmount !== null &&
    positionAssets !== undefined &&
    parsedAmount > positionAssets;
  const positionLoading =
    isSignedIn && (shareRead.isLoading || (shareRead.data !== undefined && assetsRead.isLoading));
  const fundsKnown = mode === "deposit" ? balanceValue !== undefined : positionAssets !== undefined;
  const canSubmit = Boolean(
    address &&
    publicClient &&
    gate.enabled &&
    parsedAmount &&
    fundsKnown &&
    !walletShort &&
    !positionShort &&
    !pending &&
    (mode === "deposit" || exit),
  );

  const yourDeposit = formatYourDeposit({
    isSignedIn,
    failed: shareRead.isError || assetsRead.isError,
    assets: positionAssets,
  });

  const actionName =
    mode === "deposit" ? "Deposit" : exit?.kind === "redeem" ? "Redeem" : "Withdraw";
  const pendingLabel =
    mode === "deposit" ? "Depositing…" : exit?.kind === "redeem" ? "Redeeming…" : "Withdrawing…";
  const kicker =
    mode === "deposit"
      ? "You're depositing"
      : exit?.kind === "redeem"
        ? "You're redeeming"
        : "You're withdrawing";

  function clearStatus() {
    setError(null);
    setNotice(null);
    setConfirmedHash(null);
  }

  async function sendSponsored(call: VaultCall): Promise<Hex> {
    if (!address) throw new Error("Sign in to continue.");
    const request = sponsoredSendRequest(call, address);
    const { hash } = await sendTransaction(request.transaction, request.options);
    return hash;
  }

  async function waitForSuccess(hash: Hex, failure: string) {
    if (!publicClient) throw new Error("Robinhood Chain is not reachable. Refresh and try again.");
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error(failure);
  }

  async function onSubmit() {
    if (!canSubmit || !address || !publicClient || parsedAmount === null) return;
    const account = getAddress(address);
    setPending(true);
    clearStatus();
    try {
      let kind: "deposit" | "withdraw" | "redeem";
      let call: VaultCall;
      let assets = parsedAmount;
      let shares: bigint | undefined;

      if (mode === "deposit") {
        kind = "deposit";
        const allowance = await publicClient.readContract({
          address: getAddress(ROBINHOOD_USDG.address),
          abi: erc20Abi,
          functionName: "allowance",
          args: [account, VAULT_ADDRESS],
        });
        if (allowance < parsedAmount) {
          const approveHash = await sendSponsored(buildVaultApprove(parsedAmount));
          await waitForSuccess(approveHash, "USDG approval did not confirm. Try again.");
        }
        try {
          await publicClient.simulateContract({
            address: VAULT_ADDRESS,
            abi: vaultAbi,
            functionName: "deposit",
            args: [parsedAmount, account],
            account,
          });
        } catch (simulationError) {
          if (unreachable(simulationError)) {
            throw new Error("Robinhood Chain is not reachable. Refresh and try again.");
          }
          throw new Error(DEPOSIT_BLOCKED);
        }
        call = buildVaultDeposit(parsedAmount, account);
      } else {
        if (!exit) throw new Error(POSITION_SHORT);
        kind = exit.kind;
        assets = exit.assets;
        shares = exit.kind === "redeem" ? exit.shares : undefined;
        try {
          if (exit.kind === "redeem") {
            await publicClient.simulateContract({
              address: VAULT_ADDRESS,
              abi: vaultAbi,
              functionName: "redeem",
              args: [exit.shares, account, account],
              account,
            });
          } else {
            await publicClient.simulateContract({
              address: VAULT_ADDRESS,
              abi: vaultAbi,
              functionName: "withdraw",
              args: [exit.assets, account, account],
              account,
            });
          }
        } catch (simulationError) {
          if (unreachable(simulationError)) {
            throw new Error("Robinhood Chain is not reachable. Refresh and try again.");
          }
          throw new Error(EXIT_BLOCKED);
        }
        call =
          exit.kind === "redeem"
            ? buildVaultRedeem(exit.shares, account)
            : buildVaultWithdraw(exit.assets, account);
      }

      const hash = await sendSponsored(call);
      await waitForSuccess(hash, "The vault transaction did not confirm. Try again.");
      setAmount("");
      await Promise.all([shareRead.refetch(), assetsRead.refetch(), refetchBalance()]).catch(
        () => undefined,
      );
      const id = await recordVault({
        kind,
        assets: assets.toString(),
        shares: shares?.toString(),
        userOpHash: hash,
      });
      const verified = await confirmVault({ id });
      if (verified.status !== "filled") {
        throw new Error(verified.reason ?? "The receipt could not be checked.");
      }
      setConfirmedHash(hash);
      setNotice(
        kind === "deposit"
          ? "Deposit confirmed."
          : kind === "redeem"
            ? "Redemption confirmed."
            : "Withdrawal confirmed.",
      );
    } catch (submitError) {
      setError(
        userFacingError(
          submitError,
          mode === "deposit"
            ? "Deposit could not be submitted. Try again."
            : "Withdrawal could not be submitted. Try again.",
        ),
      );
    } finally {
      setPending(false);
    }
  }

  const blocker = !gate.enabled
    ? (gate.reason ?? null)
    : mode === "deposit" && isSignedIn && balanceLoading
      ? "Checking your USDG balance…"
      : mode === "withdraw" && positionLoading
        ? "Checking your vault balance…"
        : mode === "deposit" && isSignedIn && balanceValue === undefined
          ? "Could not read your USDG balance."
          : mode === "withdraw" && isSignedIn && positionAssets === undefined
            ? "Could not read your vault balance."
            : walletShort
              ? WALLET_SHORT
              : positionShort
                ? POSITION_SHORT
                : null;

  const description =
    mode === "deposit" ? DEPOSIT_COPY : exit?.kind === "redeem" ? REDEEM_COPY : WITHDRAW_COPY;

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
          void onSubmit();
        }}
      >
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          spacing={2}
          value={mode}
          onValueChange={(next) => {
            if (next === "deposit" || next === "withdraw") {
              setMode(next);
              clearStatus();
            }
          }}
          aria-label="Vault action"
          className="flex w-full gap-2"
        >
          <ToggleGroupItem value="deposit" className="flex-1" disabled={pending}>
            Deposit
          </ToggleGroupItem>
          <ToggleGroupItem value="withdraw" className="flex-1" disabled={pending}>
            Withdraw
          </ToggleGroupItem>
        </ToggleGroup>
        <AmountCompose
          kicker={kicker}
          prefix="$"
          suffix="USDG"
          value={amount}
          onChange={(next) => {
            setAmount(next);
            clearStatus();
          }}
          error={error ? <p className="text-sm text-danger">{error}</p> : null}
          footer={
            <EarnActionFooter
              ready={ready}
              isSignedIn={isSignedIn}
              mode={mode}
              pending={pending}
              canSubmit={canSubmit}
              hasAmount={parsedAmount !== null}
              actionName={pending ? pendingLabel : actionName}
              gateEnabled={gate.enabled}
              message={notice ?? blocker ?? description}
              confirmedHash={confirmedHash}
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
                if (mode === "deposit") {
                  setAmount(balanceExact ? balanceExact : "0");
                } else if (positionAssets !== undefined) {
                  setAmount(formatTokenAmount(positionAssets.toString(), ROBINHOOD_USDG.decimals));
                }
                clearStatus();
              }}
              disabled={
                pending ||
                !isSignedIn ||
                (mode === "deposit"
                  ? balanceLoading || !balanceExact
                  : positionAssets === undefined)
              }
            >
              Max
            </Button>
          </div>
          <AvailableBalance
            isSignedIn={isSignedIn}
            loading={mode === "deposit" ? balanceLoading : positionLoading}
            display={
              mode === "deposit"
                ? balanceDisplay
                : positionAssets === undefined
                  ? null
                  : formatTokenAmountGrouped(positionAssets.toString(), ROBINHOOD_USDG.decimals)
            }
            label={mode === "deposit" ? "Available" : "In vault"}
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
        <span className="flex size-full items-center justify-center text-[9px] font-semibold uppercase text-foreground">
          {symbol.slice(0, 2)}
        </span>
      )}
    </span>
  );
}

function EarnActionFooter({
  ready,
  isSignedIn,
  mode,
  pending,
  canSubmit,
  hasAmount,
  gateEnabled,
  actionName,
  message,
  confirmedHash,
}: {
  ready: boolean;
  isSignedIn: boolean;
  mode: VaultMode;
  pending: boolean;
  canSubmit: boolean;
  hasAmount: boolean;
  gateEnabled: boolean;
  actionName: string;
  message: string;
  confirmedHash: Hex | null;
}) {
  if (!ready) {
    return <Skeleton className="h-11 w-full" aria-hidden />;
  }

  if (!isSignedIn) {
    return (
      <div className="flex flex-col items-center gap-3">
        <LoginButton />
        <p className="text-center text-sm text-muted">
          {mode === "deposit"
            ? "Sign in to deposit into the vault."
            : "Sign in to withdraw from the vault."}
        </p>
      </div>
    );
  }

  const label = pending
    ? actionName
    : !hasAmount
      ? "Enter an amount"
      : !gateEnabled
        ? mode === "deposit"
          ? "Deposit unavailable"
          : "Withdraw unavailable"
        : actionName;

  return (
    <div className="space-y-2">
      <Button type="submit" className="w-full" size="lg" disabled={!canSubmit}>
        {label}
      </Button>
      <p className="text-center text-xs text-muted">
        {message}
        {confirmedHash ? (
          <>
            {" "}
            <TxLink chainId={robinhoodChain.id} hash={confirmedHash} className="text-xs">
              {shortenAddress(confirmedHash, 6)}
            </TxLink>
          </>
        ) : null}
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
  loading,
  display,
  label,
}: {
  isSignedIn: boolean;
  loading: boolean;
  display: string | null;
  label: string;
}) {
  const value = !isSignedIn
    ? "—"
    : loading
      ? "…"
      : display
        ? `${display} ${ROBINHOOD_USDG.symbol}`
        : `0 ${ROBINHOOD_USDG.symbol}`;

  return (
    <p className="pr-mono text-xs text-muted">
      {label}: {value}
    </p>
  );
}
