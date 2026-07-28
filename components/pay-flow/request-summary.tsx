"use client";

import { StatusBadge } from "@/components/status-badge";
import { TokenChainIcon } from "@/components/token-chain-icon";
import { ROBINHOOD_USDG } from "@/lib/destination";
import { formatTokenAmount, formatUsdFromMicros } from "@/lib/money";
import { shortenAddress } from "@/lib/utils";

type PayRequestSummaryProps = {
  amountUsdMicros: number;
  status: string;
  destinationTokenSymbol: string;
  outputAmountBaseUnits: string;
  destinationTokenDecimals: number;
  recipientAddress: string;
  description?: string | null;
};

export function PayRequestSummary({
  amountUsdMicros,
  status,
  destinationTokenSymbol,
  outputAmountBaseUnits,
  destinationTokenDecimals,
  recipientAddress,
  description,
}: PayRequestSummaryProps) {
  return (
    <section className="pr-panel space-y-3 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-subtle">Payment request</p>
          <h1 className="mt-1 pr-display text-3xl text-foreground">
            ${formatUsdFromMicros(amountUsdMicros)} USD
          </h1>
        </div>
        <StatusBadge status={status} />
      </div>
      <div className="flex items-center gap-3 rounded-lg border border-border bg-[var(--panel-elevated)] px-3 py-2.5">
        <TokenChainIcon
          tokenSymbol={destinationTokenSymbol}
          tokenLogoUrl={ROBINHOOD_USDG.logoUrl}
          chainName="Robinhood"
          chainLogoUrl={ROBINHOOD_USDG.chainLogoUrl}
          size="lg"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            {formatTokenAmount(outputAmountBaseUnits, destinationTokenDecimals)}{" "}
            {destinationTokenSymbol}
          </p>
          <p className="text-xs text-subtle">
            Robinhood Chain → {shortenAddress(recipientAddress, 6)}
          </p>
        </div>
      </div>
      <dl className="grid gap-2 text-sm text-muted">
        {description && (
          <div className="flex justify-between gap-4">
            <dt>Note</dt>
            <dd className="text-right text-foreground">{description}</dd>
          </div>
        )}
      </dl>
      <p className="text-xs text-subtle">
        The USD amount is converted 1:1 into {destinationTokenSymbol} base units. Across fees may
        increase what you send on the origin chain; the recipient must receive at least the
        requested token amount before this request is marked paid.
      </p>
    </section>
  );
}
