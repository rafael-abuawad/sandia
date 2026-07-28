"use client";

import { ChevronDown } from "lucide-react";
import { TokenChainIcon } from "@/components/token-chain-icon";
import type { AcrossSwapQuote, AcrossChain, AcrossToken } from "@/lib/across/client";
import { chainName } from "@/lib/chains";
import { ROBINHOOD_USDG } from "@/lib/destination";
import { formatTokenAmount } from "@/lib/money";

type PayQuoteDetailsProps = {
  quote: AcrossSwapQuote;
  tradeType: "exactOutput" | "minOutput" | null;
  selectedToken?: AcrossToken;
  originChainId: number | null;
  chains: AcrossChain[];
  destinationTokenSymbol: string;
  destinationTokenDecimals: number;
  outputAmountBaseUnits: string;
};

export function PayQuoteDetails({
  quote,
  tradeType,
  selectedToken,
  originChainId,
  chains,
  destinationTokenSymbol,
  destinationTokenDecimals,
  outputAmountBaseUnits,
}: PayQuoteDetailsProps) {
  return (
    <details className="group rounded-lg border border-border bg-[var(--panel-elevated)] text-sm open:pb-0">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-muted marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="group-open:hidden">See more</span>
        <span className="hidden group-open:inline">See less</span>
        <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-2 border-t border-border px-4 py-3">
        <div className="flex justify-between gap-3 text-muted">
          <span>You send (est.)</span>
          <span className="flex items-center gap-2 text-foreground">
            {selectedToken && (
              <TokenChainIcon
                tokenSymbol={selectedToken.symbol}
                tokenLogoUrl={selectedToken.logoUrl}
                chainName={chainName(originChainId ?? 0)}
                chainLogoUrl={chains.find((c) => c.chainId === originChainId)?.logoUrl}
                size="sm"
              />
            )}
            {formatTokenAmount(
              quote.inputAmount ?? quote.maxInputAmount ?? "0",
              selectedToken?.decimals ?? 18,
            )}{" "}
            {selectedToken?.symbol ?? "TOKEN"}
          </span>
        </div>
        <div className="flex justify-between gap-3 text-muted">
          <span>Min received</span>
          <span className="flex items-center gap-2 text-foreground">
            <TokenChainIcon
              tokenSymbol={destinationTokenSymbol}
              tokenLogoUrl={ROBINHOOD_USDG.logoUrl}
              chainName="Robinhood"
              chainLogoUrl={ROBINHOOD_USDG.chainLogoUrl}
              size="sm"
            />
            {formatTokenAmount(
              quote.minOutputAmount ?? outputAmountBaseUnits,
              destinationTokenDecimals,
            )}{" "}
            {destinationTokenSymbol}
          </span>
        </div>
        <div className="flex justify-between text-muted">
          <span>Expected received</span>
          <span className="text-foreground">
            {formatTokenAmount(
              quote.expectedOutputAmount ?? outputAmountBaseUnits,
              destinationTokenDecimals,
            )}{" "}
            {destinationTokenSymbol}
          </span>
        </div>
        {quote.fees?.total?.amountUsd && (
          <div className="flex justify-between text-muted">
            <span>Fees (est. USD)</span>
            <span className="text-foreground">
              ${Number.parseFloat(quote.fees.total.amountUsd).toFixed(4)}
            </span>
          </div>
        )}
        {quote.expectedFillTime !== undefined && (
          <div className="flex justify-between text-muted">
            <span>Est. fill time</span>
            <span className="text-foreground">~{quote.expectedFillTime}s</span>
          </div>
        )}
        <div className="flex justify-between text-muted">
          <span>Route / trade type</span>
          <span className="text-foreground">
            {quote.crossSwapType ?? "—"} · {tradeType}
          </span>
        </div>
        <p className="pt-1 text-xs text-subtle">
          Slippage: auto (Across). Quotes are not cached and may change every block.
        </p>
      </div>
    </details>
  );
}
