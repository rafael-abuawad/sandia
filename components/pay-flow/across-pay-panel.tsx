"use client";

import { useId } from "react";
import { LoginButton } from "@/components/login-button";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
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

function payBlockerMessage({
  originChainId,
  inputToken,
  step,
  quote,
  quoteError,
}: {
  originChainId: number | null;
  inputToken: string;
  step: PayStep;
  quote: AcrossSwapQuote | null;
  quoteError: string | null;
}): string | null {
  if (step === "approving" || step === "paying" || step === "tracking") return null;
  if (!originChainId) return "Select a chain to continue.";
  if (!inputToken) return "Select a token to continue.";
  if (step === "quoting") return "Fetching a quote…";
  if (quoteError) return quoteError;
  if (!quote?.swapTx) return "Waiting for a valid route before you can pay.";
  return null;
}

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
  const errorId = useId();
  const blockerId = useId();
  const chainId = useId();
  const tokenId = useId();
  const blocker = isConnected
    ? payBlockerMessage({ originChainId, inputToken, step, quote, quoteError })
    : null;
  const busy = step === "approving" || step === "paying" || step === "tracking";
  const isError = step === "error";

  function handlePay() {
    if (!canPay) return;
    onPay();
  }

  return (
    <section className="pr-panel pr-panel--padded space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="pr-section-title">Pay with Across</h2>
        <div className="[&_button]:w-full sm:[&_button]:w-auto">
          <LoginButton />
        </div>
      </div>

      {!isConnected ? (
        <p className="text-sm text-muted">
          Sign in with a wallet, Google, or email to see available routes and pay.
        </p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={chainId}>Chain</Label>
              <ChainSelect
                id={chainId}
                value={originChainId !== null ? String(originChainId) : undefined}
                onValueChange={onChainChange}
                options={chainOptions}
                placeholder="Select chain"
                disabled={chainOptions.length === 0}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={tokenId}>Token</Label>
              <TokenSelect
                id={tokenId}
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
              <FieldError id={errorId} message={quoteError} />
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

          {isError && statusMsg && (
            <div className="pr-inset pr-inset--danger space-y-2 p-3">
              <p className="text-sm text-danger" role="alert">
                {statusMsg}
              </p>
              <Button variant="secondary" size="sm" onClick={quote ? onPay : onRefreshQuote}>
                Try again
              </Button>
            </div>
          )}

          <div className="sticky bottom-0 z-10 -mx-4 space-y-2 border-t border-border bg-panel-elevated px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
            {blocker && !busy && (
              <p id={blockerId} className="text-sm text-muted" role="status">
                {blocker}
              </p>
            )}
            <Button
              className="w-full"
              disabled={!canPay || busy}
              aria-describedby={!canPay && blocker ? blockerId : undefined}
              onClick={handlePay}
            >
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
          </div>

          {statusMsg && !isError && (
            <p className="text-sm text-muted" role="status">
              {statusMsg}
            </p>
          )}
          {(txSuccess || txError) && pendingTx && (
            <p className="pr-mono text-xs text-muted">Last tx: {shortenAddress(pendingTx, 8)}</p>
          )}
        </>
      )}
    </section>
  );
}
