"use client";

import { AppBrand } from "@/components/app-brand";
import { PayAcrossPanel } from "@/components/pay-flow/across-pay-panel";
import { PayAttemptsList, PayTerminalStatus } from "@/components/pay-flow/attempts-list";
import { PayRequestLoading } from "@/components/pay-flow/pay-request-loading";
import { PayRequestSummary } from "@/components/pay-flow/request-summary";
import { usePayFlow } from "@/components/pay-flow/use-pay-flow";

type PayFlowProps = {
  publicId: string;
};

export function PayFlow({ publicId }: PayFlowProps) {
  const {
    request,
    attempts,
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
    directPay,
    directBalance,
    robinhoodEth,
    ethBalance,
    canPay,
    paymentInProgress,
    payerAddress,
    statusMsg,
    pendingTx,
    txSuccess,
    txError,
    depositTxnRef,
    onChainChange,
    onTokenChange,
    refreshQuote,
    executePayment,
  } = usePayFlow(publicId);

  if (request === undefined) {
    return <PayRequestLoading />;
  }
  if (request === null) {
    return (
      <div className="space-y-2">
        <h1 className="pr-display text-2xl">Payment request</h1>
        <p className="text-sm text-danger">Payment request not found.</p>
      </div>
    );
  }

  const isTerminalPaid = request.status === "completed" || step === "done";
  const isUnavailable =
    request.status === "cancelled" || request.status === "expired" || request.status === "failed";

  return (
    <div className="space-y-6">
      <AppBrand name="Sandia" />
      <PayRequestSummary
        amountUsdMicros={request.amountUsdMicros}
        status={request.status}
        destinationTokenSymbol={request.destinationTokenSymbol}
        outputAmountBaseUnits={request.outputAmountBaseUnits}
        destinationTokenDecimals={request.destinationTokenDecimals}
        recipientAddress={request.recipientAddress}
        description={request.description}
      />

      {isTerminalPaid ? (
        <PayTerminalStatus kind="completed" depositTxnRef={depositTxnRef} />
      ) : isUnavailable ? (
        <PayTerminalStatus kind="unavailable" statusLabel={request.status} />
      ) : (
        <PayAcrossPanel
          isConnected={isConnected}
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
          destinationTokenSymbol={request.destinationTokenSymbol}
          destinationTokenDecimals={request.destinationTokenDecimals}
          outputAmountBaseUnits={request.outputAmountBaseUnits}
          directPay={directPay}
          directBalance={directBalance}
          robinhoodEth={robinhoodEth}
          ethBalance={ethBalance}
          canPay={canPay}
          payerAddress={payerAddress}
          paymentInProgress={Boolean(paymentInProgress)}
          expiresAt={request.expiresAt}
          statusMsg={statusMsg}
          pendingTx={pendingTx}
          txSuccess={txSuccess}
          txError={txError}
          onChainChange={onChainChange}
          onTokenChange={onTokenChange}
          onRefreshQuote={() => void refreshQuote()}
          onPay={() => void executePayment()}
        />
      )}

      {attempts && attempts.length > 0 && <PayAttemptsList attempts={attempts} />}
    </div>
  );
}
