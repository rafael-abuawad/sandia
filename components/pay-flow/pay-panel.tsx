"use client";

import { useId, useState } from "react";
import { Check, Copy } from "lucide-react";
import { PaymentQr } from "@/components/payment-qr";
import { StatusBadge } from "@/components/status-badge";
import { TokenChainIcon } from "@/components/token-chain-icon";
import { ChainSelect, TokenSelect } from "@/components/token-chain-select";
import { TxLink } from "@/components/tx-link";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { usePayFlow } from "@/components/pay-flow/use-pay-flow";
import { formatDisplayDateTime } from "@/lib/format-datetime";
import { formatTokenAmount } from "@/lib/money";
import { STELLAR_USDC } from "@/lib/stellar/constants";
import { shortenAddress } from "@/lib/utils";

type PayFlow = ReturnType<typeof usePayFlow>;

function directBlocker(flow: PayFlow): string | null {
  if (flow.recipientChecked && !flow.recipientReady) {
    return "The recipient's wallet isn't ready to receive USDC yet. Ask them to open Sandia.";
  }
  switch (flow.directBalance) {
    case "loading":
      return "Checking your USDC balance…";
    case "unavailable":
      return "USDC balance could not be checked. Refresh and try again.";
    case "no_trustline":
      return "This wallet hasn't enabled USDC. Add the USDC asset in your wallet, then come back.";
    case "short":
      return "This wallet doesn't have enough USDC on Stellar.";
    default:
      return null;
  }
}

export function PayPanel({
  flow,
  amountBaseUnits,
  decimals,
  symbol,
  expiresAt,
}: {
  flow: PayFlow;
  amountBaseUnits: string;
  decimals: number;
  symbol: string;
  expiresAt?: number;
}) {
  return (
    <section className="pr-panel pr-panel--padded space-y-4">
      <h2 className="pr-section-title">Pay</h2>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        spacing={2}
        value={flow.method}
        onValueChange={(next) => {
          if (next === "stellar" || next === "route") flow.setMethod(next);
        }}
        aria-label="Payment method"
        className="flex w-full gap-2"
      >
        <ToggleGroupItem value="stellar" className="flex-1">
          Stellar wallet
        </ToggleGroupItem>
        <ToggleGroupItem value="route" className="flex-1">
          Another network
        </ToggleGroupItem>
      </ToggleGroup>
      {flow.paymentInProgress ? (
        <p className="text-sm text-muted" role="status">
          A payment is already in progress for this request. Wait for it before paying again.
        </p>
      ) : null}
      <p className="text-xs text-muted">
        {expiresAt
          ? `Expires ${formatDisplayDateTime(expiresAt)}.`
          : "This request stays open until it is paid or cancelled."}
      </p>
      {flow.method === "stellar" ? (
        <DirectPay
          flow={flow}
          amountBaseUnits={amountBaseUnits}
          decimals={decimals}
          symbol={symbol}
        />
      ) : (
        <RoutePay flow={flow} />
      )}
    </section>
  );
}

function DirectPay({
  flow,
  amountBaseUnits,
  decimals,
  symbol,
}: {
  flow: PayFlow;
  amountBaseUnits: string;
  decimals: number;
  symbol: string;
}) {
  const blockerId = useId();
  const isError = flow.step === "error";
  const paying = flow.step === "paying";
  const blocker = flow.payerAddress && !paying ? directBlocker(flow) : null;

  if (!flow.payerAddress) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted">
          Connect a Stellar wallet to pay. Paying does not create a Sandia account.
        </p>
        <Button type="button" className="w-full" disabled={flow.connecting} onClick={flow.connect}>
          {flow.connecting ? "Connecting…" : "Connect wallet"}
        </Button>
        {flow.statusMsg ? <StatusNotice flow={flow} /> : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Paying from{" "}
        <span className="pr-mono text-foreground">{shortenAddress(flow.payerAddress, 4)}</span>
      </p>
      <div className="pr-inset space-y-0">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="text-sm text-muted">You send</span>
          <span className="flex min-w-0 items-center gap-2 text-sm text-foreground">
            <TokenChainIcon
              tokenSymbol={symbol}
              tokenLogoUrl={STELLAR_USDC.logoUrl}
              chainName={STELLAR_USDC.chainName}
              chainLogoUrl={STELLAR_USDC.chainLogoUrl}
              size="sm"
            />
            <span className="pr-money font-semibold">
              {formatTokenAmount(amountBaseUnits, decimals)} {symbol}
            </span>
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 border-bs border-border px-4 py-3 text-sm">
          <span className="text-muted">Route fee</span>
          <span className="text-foreground">None</span>
        </div>
        <p className="border-bs border-border px-4 py-3 text-xs text-muted">
          USDC moves directly on Stellar. Your wallet pays a small network fee in XLM.
        </p>
      </div>
      {isError || flow.statusMsg ? <StatusNotice flow={flow} /> : null}
      <div className="space-y-2">
        {blocker ? (
          <p id={blockerId} className="text-sm text-muted" role="status">
            {blocker}
          </p>
        ) : null}
        <Button
          type="button"
          className="w-full"
          disabled={!flow.canPay}
          aria-describedby={!flow.canPay && blocker ? blockerId : undefined}
          onClick={() => void flow.executePayment()}
        >
          {paying ? "Confirm in your wallet…" : "Pay"}
        </Button>
      </div>
    </div>
  );
}

function StatusNotice({ flow }: { flow: PayFlow }) {
  const isError = flow.step === "error";
  return (
    <div className={isError ? "pr-inset pr-inset--danger space-y-2 p-3" : "space-y-2"}>
      <p className={isError ? "text-sm text-danger" : "text-sm text-muted"} role="status">
        {flow.statusMsg}
      </p>
      {flow.pendingHash ? (
        <p className="text-xs text-muted">
          Transaction{" "}
          <TxLink hash={flow.pendingHash} className="text-xs">
            {shortenAddress(flow.pendingHash, 8)}
          </TxLink>
        </p>
      ) : null}
      {flow.paymentSent ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={flow.checkingPayment}
          onClick={() => void flow.retryVerification()}
        >
          {flow.checkingPayment ? "Checking…" : "Check again"}
        </Button>
      ) : null}
    </div>
  );
}

function RoutePay({ flow }: { flow: PayFlow }) {
  const networkId = useId();
  const tokenId = useId();
  const refundId = useId();
  const errorId = useId();

  if (flow.activeDeposit) return <DepositInstructions flow={flow} />;

  const ready = Boolean(flow.assetId && flow.refundTo.trim());
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Send from any wallet or exchange on another network. A NEAR Intents route converts it, and
        the recipient gets USDC on Stellar.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={networkId}>Network</Label>
          <ChainSelect
            id={networkId}
            value={flow.network || undefined}
            onValueChange={flow.onNetworkChange}
            options={flow.networks}
            placeholder="Select network"
            disabled={flow.networks.length === 0}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={tokenId}>Token</Label>
          <TokenSelect
            id={tokenId}
            value={flow.assetId || undefined}
            onValueChange={flow.setAssetId}
            options={flow.tokens}
            placeholder={flow.network ? "Select token" : "Select a network first"}
            disabled={flow.tokens.length === 0}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor={refundId}>Your refund address</Label>
        <Input
          id={refundId}
          value={flow.refundTo}
          onChange={(event) => flow.setRefundTo(event.target.value)}
          placeholder="An address you control on this network"
          autoComplete="off"
          className="pr-mono"
          aria-describedby={flow.depositError ? errorId : undefined}
        />
        <p className="text-xs text-muted">
          If the route can&apos;t complete, or you send too much, the difference returns here.
          Don&apos;t use an exchange deposit address.
        </p>
      </div>
      <FieldError id={errorId} message={flow.depositError ?? flow.routesError} />
      <Button
        type="button"
        className="w-full"
        disabled={!ready || flow.creatingDeposit || !flow.recipientReady}
        onClick={() => void flow.requestDeposit()}
      >
        {flow.creatingDeposit ? "Getting a quote…" : "Get deposit address"}
      </Button>
      {flow.recipientChecked && !flow.recipientReady ? (
        <p className="text-sm text-muted" role="status">
          The recipient&apos;s wallet isn&apos;t ready to receive USDC yet. Ask them to open Sandia.
        </p>
      ) : null}
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.error("deposit_copy_failed", {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return (
    <div className="space-y-1 px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <div className="flex items-start justify-between gap-3">
        <p className="pr-mono min-w-0 break-all text-sm font-semibold text-foreground">{value}</p>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0"
          aria-label={copied ? `${label} copied` : `Copy ${label.toLowerCase()}`}
          onClick={() => void copy()}
        >
          {copied ? (
            <Check className="size-4" strokeWidth={1.5} aria-hidden />
          ) : (
            <Copy className="size-4" strokeWidth={1.5} aria-hidden />
          )}
        </Button>
      </div>
    </div>
  );
}

function DepositInstructions({ flow }: { flow: PayFlow }) {
  const deposit = flow.activeDeposit;
  if (!deposit?.depositAddress || !deposit.amountIn) return null;
  const decimals = deposit.originDecimals ?? 18;
  const amount = formatTokenAmount(deposit.amountIn, decimals);
  const terminal = deposit.status !== "awaiting_deposit" && deposit.status !== "processing";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">
          Send on {deposit.originChain ?? "this network"}
        </p>
        <StatusBadge status={deposit.status} />
      </div>
      {deposit.status === "awaiting_deposit" ? (
        <>
          <div className="flex justify-center">
            <PaymentQr value={deposit.depositAddress} />
          </div>
          <div className="pr-inset divide-y divide-border">
            <CopyRow label={`Amount (${deposit.originSymbol ?? "token"})`} value={amount} />
            <CopyRow label="Deposit address" value={deposit.depositAddress} />
            {deposit.depositMemo ? <CopyRow label="Memo" value={deposit.depositMemo} /> : null}
          </div>
          {deposit.depositMemo ? (
            <p className="text-sm font-medium text-danger" role="alert">
              Include this memo. Without it, your funds can&apos;t be matched to this payment.
            </p>
          ) : null}
          <p className="text-xs text-muted">
            Send this exact token on {deposit.originChain}. Any amount above what the route needs is
            refunded to your refund address. This address expires
            {deposit.deadline ? ` ${formatDisplayDateTime(deposit.deadline)}` : " soon"}. A deposit
            after that is refunded.
          </p>
        </>
      ) : null}
      {deposit.status === "processing" ? (
        <p className="text-sm text-muted" role="status">
          {deposit.failureReason ??
            `Deposit received. Converting it to USDC on Stellar${
              deposit.timeEstimate ? `, usually about ${deposit.timeEstimate} seconds` : ""
            }…`}
        </p>
      ) : null}
      {deposit.status === "refunded" ? (
        <p className="text-sm text-muted" role="status">
          This deposit was refunded to your refund address. You can try again.
        </p>
      ) : null}
      {deposit.status === "expired" ? (
        <p className="text-sm text-muted" role="status">
          This deposit address expired. Get a new one to pay.
        </p>
      ) : null}
      {deposit.status === "failed" ? (
        <p className="text-sm text-danger" role="alert">
          {deposit.failureReason ?? "This route failed. Any deposit is refunded."}
        </p>
      ) : null}
      {deposit.status === "ignored_duplicate" ? (
        <p className="text-sm text-muted" role="status">
          {deposit.failureReason ?? "This request was already closed when your payment arrived."}
        </p>
      ) : null}
      {deposit.txHash ? (
        <p className="text-xs text-muted">
          Stellar transaction{" "}
          <TxLink hash={deposit.txHash} className="text-xs">
            {shortenAddress(deposit.txHash, 8)}
          </TxLink>
        </p>
      ) : null}
      {deposit.status === "awaiting_deposit" || terminal ? (
        <Button type="button" variant="secondary" className="w-full" onClick={flow.clearDeposit}>
          {terminal ? "Start over" : "Use a different token"}
        </Button>
      ) : null}
    </div>
  );
}
