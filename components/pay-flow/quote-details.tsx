"use client";

import { ChevronDown } from "lucide-react";
import { TokenChainIcon } from "@/components/token-chain-icon";
import type { AcrossSwapQuote, AcrossChain, AcrossToken } from "@/lib/across/client";
import { chainName, displayTokenSymbol } from "@/lib/chains";
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

function tradeTypeLabel(tradeType: "exactOutput" | "minOutput" | null): string {
  if (tradeType === "exactOutput") return "Exact output";
  if (tradeType === "minOutput") return "Minimum output";
  return "Quote";
}

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
  const sendAmount = formatTokenAmount(
    quote.inputAmount ?? quote.maxInputAmount ?? "0",
    selectedToken?.decimals ?? 18,
  );
  const sendSymbol = selectedToken ? displayTokenSymbol(selectedToken.symbol) : "TOKEN";

  return (
    <div className="pr-inset space-y-0">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <span className="text-sm text-muted">You send (est.)</span>
        <span className="flex min-w-0 items-center gap-2 text-sm text-foreground">
          {selectedToken && (
            <TokenChainIcon
              tokenSymbol={sendSymbol}
              tokenLogoUrl={selectedToken.logoUrl}
              chainName={chainName(originChainId ?? 0)}
              chainLogoUrl={chains.find((c) => c.chainId === originChainId)?.logoUrl}
              chainId={originChainId}
              size="sm"
            />
          )}
          <span className="pr-money font-semibold">
            {sendAmount} {sendSymbol}
          </span>
        </span>
      </div>

      <details className="group border-t border-border text-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-muted marker:content-none hover:bg-foreground/[0.03] hover:text-foreground [&::-webkit-details-marker]:hidden">
          <span className="group-open:hidden">Show quote details</span>
          <span className="hidden group-open:inline">Hide quote details</span>
          <ChevronDown
            className="h-4 w-4 shrink-0 transition-transform duration-[var(--duration)] ease-[var(--ease-out)] group-open:rotate-180"
            strokeWidth={1.5}
          />
        </summary>
        <div className="space-y-2 border-t border-border px-4 py-3">
          <div className="flex justify-between gap-3 text-muted">
            <span>Min received</span>
            <span className="flex items-center gap-2 text-foreground">
              <TokenChainIcon
                tokenSymbol={destinationTokenSymbol}
                tokenLogoUrl={ROBINHOOD_USDG.logoUrl}
                chainName="Robinhood"
                chainLogoUrl={ROBINHOOD_USDG.chainLogoUrl}
                chainId={ROBINHOOD_USDG.chainId}
                size="sm"
              />
              <span className="pr-money">
                {formatTokenAmount(
                  quote.minOutputAmount ?? outputAmountBaseUnits,
                  destinationTokenDecimals,
                )}{" "}
                {destinationTokenSymbol}
              </span>
            </span>
          </div>
          <div className="flex justify-between text-muted">
            <span>Expected received</span>
            <span className="pr-money text-foreground">
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
              <span className="pr-money text-foreground">
                ${Number.parseFloat(quote.fees.total.amountUsd).toFixed(4)}
              </span>
            </div>
          )}
          {quote.expectedFillTime !== undefined && (
            <div className="flex justify-between text-muted">
              <span>Est. fill time</span>
              <span className="pr-money text-foreground">~{quote.expectedFillTime}s</span>
            </div>
          )}
          <div className="flex justify-between text-muted">
            <span>Route</span>
            <span className="text-right text-foreground">{tradeTypeLabel(tradeType)}</span>
          </div>
          <p className="pt-1 text-xs text-muted">
            This route converts your tokens into USDG on Robinhood Chain. Quotes are not cached and
            may change every block.
          </p>
        </div>
      </details>
    </div>
  );
}
