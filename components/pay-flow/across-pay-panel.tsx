"use client";

import { useId } from "react";
import { PayConnectButton } from "@/components/pay-connect-button";
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
import { TokenChainIcon } from "@/components/token-chain-icon";
import { PayQuoteDetails } from "@/components/pay-flow/quote-details";
import type { DirectPayBalance } from "@/components/pay-flow/use-pay-flow";
import type { PayStep } from "@/components/pay-flow/state";
import type { EthSwapQuote } from "@/lib/zerox-quote";
import {
  quoteFundingGap,
  type AcrossChain,
  type AcrossSwapQuote,
  type AcrossToken,
} from "@/lib/across/client";
import { formatDisplayDateTime } from "@/lib/format-datetime";
import { ROBINHOOD_USDG } from "@/lib/destination";
import { formatTokenAmount, formatTokenAmountGrouped } from "@/lib/money";
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
  ethQuote: EthSwapQuote | null;
  tradeType: "exactOutput" | "minOutput" | null;
  selectedToken?: AcrossToken;
  chains: AcrossChain[];
  destinationTokenSymbol: string;
  destinationTokenDecimals: number;
  outputAmountBaseUnits: string;
  directPay: boolean;
  directBalance: DirectPayBalance | null;
  robinhoodEth: boolean;
  ethBalance: DirectPayBalance | null;
  canPay: boolean;
  payerAddress?: string;
  paymentInProgress?: boolean;
  expiresAt?: number;
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
  tokenSymbol,
  directPay,
  directBalance,
  robinhoodEth,
  ethQuote,
  ethBalance,
}: {
  originChainId: number | null;
  inputToken: string;
  step: PayStep;
  quote: AcrossSwapQuote | null;
  quoteError: string | null;
  tokenSymbol?: string;
  directPay: boolean;
  directBalance: DirectPayBalance | null;
  robinhoodEth: boolean;
  ethQuote: EthSwapQuote | null;
  ethBalance: DirectPayBalance | null;
}): string | null {
  if (step === "approving" || step === "paying" || step === "tracking") return null;
  if (directPay) {
    if (directBalance === "loading") return "Checking your USDG balance…";
    if (directBalance === "unavailable") {
      return "USDG balance could not be checked. Refresh and try again.";
    }
    if (directBalance === "short") {
      return "This wallet doesn't have enough USDG on Robinhood Chain.";
    }
    return null;
  }
  if (robinhoodEth) {
    if (step === "quoting") return "Fetching a quote…";
    if (quoteError) return null;
    if (!ethQuote) return "Waiting for a valid route before you can pay.";
    if (ethBalance === "loading") return "Checking your ETH balance…";
    if (ethBalance === "unavailable") {
      return "ETH balance could not be checked. Refresh and try again.";
    }
    if (ethBalance === "short") {
      return "This wallet doesn't have enough ETH on Robinhood Chain.";
    }
    return null;
  }
  if (!originChainId) return "Select a chain to continue.";
  if (!inputToken) return "Select a token to continue.";
  if (step === "quoting") return "Fetching a quote…";
  if (quoteError) return null;
  if (!quote?.swapTx) return "Waiting for a valid route before you can pay.";
  const gap = quoteFundingGap(quote);
  if (gap === "balance") {
    return `This wallet doesn't have enough ${tokenSymbol ?? "of this token"} on this chain.`;
  }
  if (quote.swapTx.simulationSuccess === false && gap !== "allowance") {
    return "This route could not be simulated. Try another token.";
  }
  return null;
}

function payButtonLabel(step: PayStep): string {
  if (step === "approving") return "Confirm approval…";
  if (step === "paying") return "Confirm payment…";
  if (step === "tracking") return "Waiting for settlement…";
  return "Pay";
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
  ethQuote,
  tradeType,
  selectedToken,
  chains,
  destinationTokenSymbol,
  destinationTokenDecimals,
  outputAmountBaseUnits,
  directPay,
  directBalance,
  robinhoodEth,
  ethBalance,
  canPay,
  payerAddress,
  paymentInProgress,
  expiresAt,
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
    ? payBlockerMessage({
        originChainId,
        inputToken,
        step,
        quote,
        quoteError,
        tokenSymbol: selectedToken?.symbol,
        directPay,
        directBalance,
        robinhoodEth,
        ethQuote,
        ethBalance,
      })
    : null;
  const busy = step === "approving" || step === "paying" || step === "tracking";
  const isError = step === "error";

  return (
    <section className="pr-panel pr-panel--padded space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="pr-section-title">Pay</h2>
        <PayConnectButton />
      </div>

      {isConnected ? (
        <PayAcrossConnected
          originChainId={originChainId}
          inputToken={inputToken}
          chainOptions={chainOptions}
          tokenOptions={tokenOptions}
          step={step}
          quoteError={quoteError}
          quote={quote}
          ethQuote={ethQuote}
          tradeType={tradeType}
          selectedToken={selectedToken}
          chains={chains}
          destinationTokenSymbol={destinationTokenSymbol}
          destinationTokenDecimals={destinationTokenDecimals}
          outputAmountBaseUnits={outputAmountBaseUnits}
          directPay={directPay}
          robinhoodEth={robinhoodEth}
          canPay={canPay}
          payerAddress={payerAddress}
          paymentInProgress={paymentInProgress}
          expiresAt={expiresAt}
          statusMsg={statusMsg}
          pendingTx={pendingTx}
          txSuccess={txSuccess}
          txError={txError}
          errorId={errorId}
          blockerId={blockerId}
          chainId={chainId}
          tokenId={tokenId}
          blocker={blocker}
          busy={busy}
          isError={isError}
          onChainChange={onChainChange}
          onTokenChange={onTokenChange}
          onRefreshQuote={onRefreshQuote}
          onPay={onPay}
        />
      ) : (
        <p className="text-sm text-muted">
          Connect a wallet to pay. Paying does not create a Sandia account.
        </p>
      )}
    </section>
  );
}

function PayAcrossConnected({
  originChainId,
  inputToken,
  chainOptions,
  tokenOptions,
  step,
  quoteError,
  quote,
  ethQuote,
  tradeType,
  selectedToken,
  chains,
  destinationTokenSymbol,
  destinationTokenDecimals,
  outputAmountBaseUnits,
  directPay,
  robinhoodEth,
  canPay,
  payerAddress,
  paymentInProgress,
  expiresAt,
  statusMsg,
  pendingTx,
  txSuccess,
  txError,
  errorId,
  blockerId,
  chainId,
  tokenId,
  blocker,
  busy,
  isError,
  onChainChange,
  onTokenChange,
  onRefreshQuote,
  onPay,
}: Omit<PayAcrossPanelProps, "isConnected" | "directBalance" | "ethBalance"> & {
  errorId: string;
  blockerId: string;
  chainId: string;
  tokenId: string;
  blocker: string | null;
  busy: boolean;
  isError: boolean;
}) {
  return (
    <>
      <PayAcrossSessionInfo
        payerAddress={payerAddress}
        paymentInProgress={paymentInProgress}
        expiresAt={expiresAt}
      />
      <PayAcrossRouteFields
        originChainId={originChainId}
        inputToken={inputToken}
        chainOptions={chainOptions}
        tokenOptions={tokenOptions}
        chainId={chainId}
        tokenId={tokenId}
        onChainChange={onChainChange}
        onTokenChange={onTokenChange}
      />
      <PayAcrossQuoteBlock
        step={step}
        quoteError={quoteError}
        quote={quote}
        ethQuote={ethQuote}
        robinhoodEth={robinhoodEth}
        tradeType={tradeType}
        selectedToken={selectedToken}
        originChainId={originChainId}
        chains={chains}
        destinationTokenSymbol={destinationTokenSymbol}
        destinationTokenDecimals={destinationTokenDecimals}
        outputAmountBaseUnits={outputAmountBaseUnits}
        directPay={directPay}
        errorId={errorId}
        onRefreshQuote={onRefreshQuote}
      />
      {isError && statusMsg ? (
        <div className="pr-inset pr-inset--danger space-y-2 p-3">
          <p className="text-sm text-danger" role="alert">
            {statusMsg}
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={directPay || ethQuote || quote ? onPay : onRefreshQuote}
          >
            Try again
          </Button>
        </div>
      ) : null}
      <PayAcrossActionBar
        blocker={blocker}
        blockerId={blockerId}
        busy={busy}
        canPay={canPay}
        step={step}
        onPay={onPay}
      />
      {statusMsg && !isError ? (
        <p className="text-sm text-muted" role="status">
          {statusMsg}
        </p>
      ) : null}
      {txSuccess || txError ? (
        pendingTx ? (
          <p className="pr-mono text-xs text-muted">Last tx: {shortenAddress(pendingTx, 8)}</p>
        ) : null
      ) : null}
    </>
  );
}

function PayAcrossSessionInfo({
  payerAddress,
  paymentInProgress,
  expiresAt,
}: {
  payerAddress?: string;
  paymentInProgress?: boolean;
  expiresAt?: number;
}) {
  return (
    <>
      {payerAddress ? (
        <p className="text-sm text-muted">
          Paying from{" "}
          <span className="pr-mono text-foreground">{shortenAddress(payerAddress, 4)}</span>
        </p>
      ) : null}
      {paymentInProgress ? (
        <p className="text-sm text-muted" role="status">
          A payment is already in progress for this request. A second deposit will not be accepted
          here.
        </p>
      ) : null}
      <p className="text-xs text-muted">
        {expiresAt
          ? `Expires ${formatDisplayDateTime(expiresAt)}.`
          : "This request stays open until it is paid or cancelled."}
      </p>
    </>
  );
}

function PayAcrossRouteFields({
  originChainId,
  inputToken,
  chainOptions,
  tokenOptions,
  chainId,
  tokenId,
  onChainChange,
  onTokenChange,
}: {
  originChainId: number | null;
  inputToken: string;
  chainOptions: ChainOption[];
  tokenOptions: TokenOption[];
  chainId: string;
  tokenId: string;
  onChainChange: (value: string) => void;
  onTokenChange: (value: string) => void;
}) {
  return (
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
  );
}

function PayEthDetails({
  ethQuote,
  destinationTokenSymbol,
  destinationTokenDecimals,
  outputAmountBaseUnits,
}: {
  ethQuote: EthSwapQuote;
  destinationTokenSymbol: string;
  destinationTokenDecimals: number;
  outputAmountBaseUnits: string;
}) {
  return (
    <div className="pr-inset space-y-0">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <span className="text-sm text-muted">You send up to</span>
        <span className="flex min-w-0 items-center gap-2 text-sm text-foreground">
          <TokenChainIcon
            tokenSymbol="ETH"
            tokenLogoUrl="/assets/tokens/eth.svg"
            chainName="Robinhood"
            chainLogoUrl={ROBINHOOD_USDG.chainLogoUrl}
            chainId={ROBINHOOD_USDG.chainId}
            size="sm"
          />
          <span className="pr-money font-semibold">
            {formatTokenAmountGrouped(ethQuote.maxSellAmount, 18, 6)} ETH
          </span>
        </span>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm">
        <span className="text-muted">Recipient receives</span>
        <span className="pr-money font-semibold text-foreground">
          {formatTokenAmount(outputAmountBaseUnits, destinationTokenDecimals)}{" "}
          {destinationTokenSymbol}
        </span>
      </div>
      <p className="border-t border-border px-4 py-3 text-xs text-muted">
        ETH swaps to USDG on Robinhood Chain. The USDG goes to the person who created this request.
        The ETH amount can change until you pay. Network gas is paid in ETH.
      </p>
    </div>
  );
}

function PayDirectDetails({
  destinationTokenSymbol,
  destinationTokenDecimals,
  outputAmountBaseUnits,
}: {
  destinationTokenSymbol: string;
  destinationTokenDecimals: number;
  outputAmountBaseUnits: string;
}) {
  return (
    <div className="pr-inset space-y-0">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <span className="text-sm text-muted">You send</span>
        <span className="flex min-w-0 items-center gap-2 text-sm text-foreground">
          <TokenChainIcon
            tokenSymbol={destinationTokenSymbol}
            tokenLogoUrl={ROBINHOOD_USDG.logoUrl}
            chainName="Robinhood"
            chainLogoUrl={ROBINHOOD_USDG.chainLogoUrl}
            chainId={ROBINHOOD_USDG.chainId}
            size="sm"
          />
          <span className="pr-money font-semibold">
            {formatTokenAmount(outputAmountBaseUnits, destinationTokenDecimals)}{" "}
            {destinationTokenSymbol}
          </span>
        </span>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm">
        <span className="text-muted">Route fee</span>
        <span className="text-foreground">None</span>
      </div>
      <p className="border-t border-border px-4 py-3 text-xs text-muted">
        USDG is transferred directly on Robinhood Chain. Network gas is paid in ETH.
      </p>
    </div>
  );
}

function PayAcrossQuoteBlock({
  step,
  quoteError,
  quote,
  ethQuote,
  robinhoodEth,
  tradeType,
  selectedToken,
  originChainId,
  chains,
  destinationTokenSymbol,
  destinationTokenDecimals,
  outputAmountBaseUnits,
  directPay,
  errorId,
  onRefreshQuote,
}: {
  step: PayStep;
  quoteError: string | null;
  quote: AcrossSwapQuote | null;
  ethQuote: EthSwapQuote | null;
  robinhoodEth: boolean;
  tradeType: "exactOutput" | "minOutput" | null;
  selectedToken?: AcrossToken;
  originChainId: number | null;
  chains: AcrossChain[];
  destinationTokenSymbol: string;
  destinationTokenDecimals: number;
  outputAmountBaseUnits: string;
  directPay: boolean;
  errorId: string;
  onRefreshQuote: () => void;
}) {
  if (directPay) {
    return (
      <PayDirectDetails
        destinationTokenSymbol={destinationTokenSymbol}
        destinationTokenDecimals={destinationTokenDecimals}
        outputAmountBaseUnits={outputAmountBaseUnits}
      />
    );
  }

  if (robinhoodEth && ethQuote && step !== "quoting") {
    return (
      <PayEthDetails
        ethQuote={ethQuote}
        destinationTokenSymbol={destinationTokenSymbol}
        destinationTokenDecimals={destinationTokenDecimals}
        outputAmountBaseUnits={outputAmountBaseUnits}
      />
    );
  }

  if (step === "quoting") {
    return <QuoteSkeleton />;
  }

  if (quoteError) {
    return (
      <div className="space-y-2">
        <FieldError id={errorId} message={quoteError} />
        <Button variant="secondary" size="sm" onClick={onRefreshQuote}>
          Retry quote
        </Button>
      </div>
    );
  }

  if (!quote) {
    return null;
  }

  return (
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
  );
}

function PayAcrossActionBar({
  blocker,
  blockerId,
  busy,
  canPay,
  step,
  onPay,
}: {
  blocker: string | null;
  blockerId: string;
  busy: boolean;
  canPay: boolean;
  step: PayStep;
  onPay: () => void;
}) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 space-y-2 border-t border-border bg-panel-elevated px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
      {blocker && !busy ? (
        <p id={blockerId} className="text-sm text-muted" role="status">
          {blocker}
        </p>
      ) : null}
      <Button
        className="w-full"
        disabled={!canPay || busy}
        aria-describedby={!canPay && blocker ? blockerId : undefined}
        onClick={() => {
          if (!canPay) return;
          onPay();
        }}
      >
        {payButtonLabel(step)}
      </Button>
    </div>
  );
}
