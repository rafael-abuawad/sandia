"use client";

import { ConnectKitButton } from "connectkit";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  ChainSelect,
  TokenSelect,
  type ChainOption,
  type TokenOption,
} from "@/components/token-chain-select";
import { QuoteSkeleton } from "@/components/quote-skeleton";
import { PayQuoteDetails } from "@/components/pay-flow/quote-details";
import type { PayStep } from "@/components/pay-flow/state";
import type { AcrossChain, AcrossSwapQuote, AcrossToken } from "@/lib/across/client";
import { shortenAddress } from "@/lib/utils";
import type { Hex } from "viem";

type PayAcrossPanelProps = {
  isConnected: boolean;
  originChainId: number | null;
  inputToken: string;
  chainOptions: ChainOption[];
  tokenOptions: TokenOption[];
  step: PayStep;
  quoteError: string | null;
  quote: AcrossSwapQuote | null;
  tradeType: "exactOutput" | "minOutput" | null;
  selectedToken?: AcrossToken;
  chains: AcrossChain[];
  destinationTokenSymbol: string;
  destinationTokenDecimals: number;
  outputAmountBaseUnits: string;
  canPay: boolean;
  statusMsg: string | null;
  pendingTx: Hex | undefined;
  txSuccess: boolean;
  txError: boolean;
  onChainChange: (value: string) => void;
  onTokenChange: (value: string) => void;
  onRefreshQuote: () => void;
  onPay: () => void;
};

export function PayAcrossPanel({
  isConnected,
  originChainId,
  inputToken,
  chainOptions,
  tokenOptions,
  step,
  quoteError,
  quote,
  tradeType,
  selectedToken,
  chains,
  destinationTokenSymbol,
  destinationTokenDecimals,
  outputAmountBaseUnits,
  canPay,
  statusMsg,
  pendingTx,
  txSuccess,
  txError,
  onChainChange,
  onTokenChange,
  onRefreshQuote,
  onPay,
}: PayAcrossPanelProps) {
  return (
    <section className="pr-panel space-y-5 p-6">
      <div className="flex items-center justify-between">
        <h2 className="pr-display text-lg text-foreground">Pay with Across</h2>
        <ConnectKitButton />
      </div>

      {!isConnected ? (
        <p className="text-sm text-muted">
          Connect a wallet to see available routes and pay. No account required.
        </p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Chain</Label>
              <ChainSelect
                value={originChainId !== null ? String(originChainId) : undefined}
                onValueChange={onChainChange}
                options={chainOptions}
                placeholder="Select chain"
                disabled={chainOptions.length === 0}
              />
            </div>
            <div className="space-y-2">
              <Label>Token</Label>
              <TokenSelect
                value={inputToken || undefined}
                onValueChange={onTokenChange}
                options={tokenOptions}
                placeholder={originChainId ? "Select token" : "Select a chain first"}
                disabled={!originChainId || tokenOptions.length === 0}
              />
            </div>
          </div>

          {step === "quoting" && <QuoteSkeleton />}

          {quoteError && step !== "quoting" && (
            <div className="space-y-2">
              <p className="text-sm text-danger">{quoteError}</p>
              <Button variant="secondary" size="sm" onClick={onRefreshQuote}>
                Retry quote
              </Button>
            </div>
          )}

          {quote && !quoteError && step !== "quoting" && (
            <PayQuoteDetails
              quote={quote}
              tradeType={tradeType}
              selectedToken={selectedToken}
              originChainId={originChainId}
              chains={chains}
              destinationTokenSymbol={destinationTokenSymbol}
              destinationTokenDecimals={destinationTokenDecimals}
              outputAmountBaseUnits={outputAmountBaseUnits}
            />
          )}

          <Button className="w-full" disabled={!canPay} onClick={onPay}>
            {step === "approving"
              ? "Confirm approval…"
              : step === "paying"
                ? "Confirm payment…"
                : step === "tracking"
                  ? "Waiting for settlement…"
                  : quoteError
                    ? "No valid route"
                    : "Pay request"}
          </Button>

          {statusMsg && <p className="text-sm text-muted">{statusMsg}</p>}
          {(txSuccess || txError) && pendingTx && (
            <p className="pr-mono text-xs text-subtle">Last tx: {shortenAddress(pendingTx, 8)}</p>
          )}
        </>
      )}
    </section>
  );
}
