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
    <section className="pr-panel pr-panel--padded space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="pr-kicker">Payment request</p>
          <h1 className="mbs-1 pr-display pr-money text-3xl text-foreground">
            ${formatUsdFromMicros(amountUsdMicros)}
          </h1>
        </div>
        <StatusBadge status={status} />
      </div>
      <div className="flex items-center gap-2.5">
        <TokenChainIcon
          tokenSymbol={destinationTokenSymbol}
          tokenLogoUrl={ROBINHOOD_USDG.logoUrl}
          chainName="Robinhood"
          chainLogoUrl={ROBINHOOD_USDG.chainLogoUrl}
          chainId={ROBINHOOD_USDG.chainId}
          size="md"
        />
        <div className="min-w-0">
          <p className="pr-money text-sm font-semibold text-foreground">
            {formatTokenAmount(outputAmountBaseUnits, destinationTokenDecimals)}{" "}
            {destinationTokenSymbol}
          </p>
          <p className="text-xs text-muted">to {shortenAddress(recipientAddress, 4)}</p>
        </div>
      </div>
      {description ? (
        <p className="text-sm text-muted">
          <span className="font-medium text-foreground">Note. </span>
          {description}
        </p>
      ) : null}
      <p className="text-xs text-muted">
        The USD amount converts 1:1 into {destinationTokenSymbol}. Paying in USDG on Robinhood sends
        that amount in full, with no route fee. Other tokens can include a route fee, and the
        recipient still receives at least the requested amount.
      </p>
    </section>
  );
}
