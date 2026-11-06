"use client";

import { AppBrand } from "@/components/app-brand";
import { PayPanel } from "@/components/pay-flow/pay-panel";
import { PayAttemptsList, PayTerminalStatus } from "@/components/pay-flow/attempts-list";
import { PayRequestLoading } from "@/components/pay-flow/pay-request-loading";
import { PayRequestSummary } from "@/components/pay-flow/request-summary";
import { usePayFlow } from "@/components/pay-flow/use-pay-flow";

type PayFlowProps = {
  publicId: string;
};

export function PayFlow({ publicId }: PayFlowProps) {
  const flow = usePayFlow(publicId);
  const { request, attempts, step, settledHash, legacyRequest, activeDeposit } = flow;

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
    legacyRequest ||
    request.status === "cancelled" ||
    request.status === "expired" ||
    request.status === "failed";
  const settlementHash =
    settledHash ??
    activeDeposit?.txHash ??
    attempts?.find((attempt) => attempt.status === "settled")?.txHash;

  return (
    <div className="space-y-6">
      <AppBrand />
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
        <PayTerminalStatus kind="completed" txHash={settlementHash} message={flow.statusMsg} />
      ) : isUnavailable ? (
        <PayTerminalStatus
          kind="unavailable"
          statusLabel={legacyRequest ? undefined : request.status}
        />
      ) : (
        <PayPanel
          flow={flow}
          amountBaseUnits={request.outputAmountBaseUnits}
          decimals={request.destinationTokenDecimals}
          symbol={request.destinationTokenSymbol}
          expiresAt={request.expiresAt}
        />
      )}

      {attempts && attempts.length > 0 && <PayAttemptsList attempts={attempts} />}
    </div>
  );
}
