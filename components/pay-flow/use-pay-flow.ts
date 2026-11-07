"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAction, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { usdMicrosToStroops } from "@/lib/stellar/amount";
import {
  fetchAccountState,
  fetchTransaction,
  StellarSubmitError,
  submitEnvelope,
} from "@/lib/stellar/horizon";
import { requestMemo } from "@/lib/stellar/memo";
import { isStellarAccount } from "@/lib/stellar/strkey";
import { useStellarAccount } from "@/lib/stellar/use-account";
import { userFacingError } from "@/lib/user-facing-error";
import {
  parseStoredSentPayment,
  RESTORED_PAYMENT_MESSAGE,
  trackedDepositKey,
  unverifiedPaymentKey,
  unverifiedPaymentMessage,
  type SentPayment,
} from "@/lib/unverified-payment";
import type { PayRoute } from "@/lib/near-intents";

export type PayMethod = "stellar" | "route";
export type PayStep = "idle" | "paying" | "done" | "error";
export type DirectPayBalance = "loading" | "short" | "ready" | "unavailable" | "no_trustline";

const DEPOSIT_POLL_MS = 10_000;

function payerBalanceState(input: {
  loading: boolean;
  error: boolean;
  exists: boolean | undefined;
  hasTrustline: boolean | undefined;
  balance: bigint | undefined;
  required: bigint | null;
}): DirectPayBalance {
  if (input.error) return "unavailable";
  if (input.loading || input.balance === undefined || input.required === null) return "loading";
  if (!input.exists || !input.hasTrustline) return "no_trustline";
  return input.balance < input.required ? "short" : "ready";
}

export function usePayFlow(publicId: string) {
  const request = useQuery(api.paymentRequests.getByPublicId, { publicId });
  const { results: attempts } = usePaginatedQuery(
    api.settlementAttempts.listByRequest,
    { publicId },
    { initialNumItems: 20 },
  );
  const submitDirect = useAction(api.settlement.submitDirect);
  const listRoutes = useAction(api.nearIntents.listRoutes);
  const createDeposit = useAction(api.nearIntents.createDeposit);
  const syncDeposit = useAction(api.nearIntents.syncDeposit);

  const [method, setMethod] = useState<PayMethod>("stellar");
  const [payerAddress, setPayerAddress] = useState<string | undefined>();
  const [connecting, setConnecting] = useState(false);
  const [step, setStep] = useState<PayStep>("idle");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [settledHash, setSettledHash] = useState<string | null>(null);
  const [sentPayment, setSentPayment] = useState<SentPayment | null>(null);
  const [verifying, setVerifying] = useState(false);
  const payLock = useRef(false);

  const [routes, setRoutes] = useState<PayRoute[]>([]);
  const [routesError, setRoutesError] = useState<string | null>(null);
  const [network, setNetwork] = useState("");
  const [assetId, setAssetId] = useState("");
  const [refundTo, setRefundTo] = useState("");
  const [depositId, setDepositId] = useState<Id<"settlementAttempts"> | null>(null);
  const [creatingDeposit, setCreatingDeposit] = useState(false);
  const [depositError, setDepositError] = useState<string | null>(null);

  const recipient = request?.recipientAddress;
  /** Requests from before the Stellar cutover point at an EVM address. */
  const legacyRequest = Boolean(recipient) && !isStellarAccount(recipient as string);
  const required = useMemo(
    () => (request && !legacyRequest ? usdMicrosToStroops(request.amountUsdMicros) : null),
    [request, legacyRequest],
  );

  const payer = useStellarAccount(method === "stellar" ? payerAddress : undefined);
  const recipientAccount = useStellarAccount(legacyRequest ? undefined : recipient);
  const directBalance: DirectPayBalance | null = payerAddress
    ? payerBalanceState({
        loading: payer.isLoading,
        error: payer.isError,
        exists: payer.data?.exists,
        hasTrustline: payer.data?.hasUsdcTrustline,
        balance: payer.data?.usdcBalance,
        required,
      })
    : null;
  const recipientReady = recipientAccount.data?.hasUsdcTrustline ?? false;

  const activeDeposit = useMemo(
    () => attempts?.find((attempt) => attempt._id === depositId) ?? null,
    [attempts, depositId],
  );

  // Restore a payment or deposit that was in flight when the tab closed.
  useEffect(() => {
    const savedDeposit = window.sessionStorage.getItem(trackedDepositKey(publicId));
    if (savedDeposit) {
      setDepositId(savedDeposit as Id<"settlementAttempts">);
      setMethod("route");
    }
    const raw = window.sessionStorage.getItem(unverifiedPaymentKey(publicId));
    if (!raw) return;
    const payment = parseStoredSentPayment(raw);
    if (!payment) {
      window.sessionStorage.removeItem(unverifiedPaymentKey(publicId));
      return;
    }
    setSentPayment(payment);
    setStep("error");
    setStatusMsg(RESTORED_PAYMENT_MESSAGE);
  }, [publicId]);

  useEffect(() => {
    if (method !== "route" || routes.length > 0) return;
    let cancelled = false;
    void listRoutes({})
      .then((rows) => {
        if (cancelled) return;
        setRoutes(rows);
        setRoutesError(null);
        setNetwork((current) => current || rows[0]?.blockchain || "");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setRoutesError(
          userFacingError(error, "Networks and tokens could not be loaded. Refresh and try again."),
        );
      });
    return () => {
      cancelled = true;
    };
  }, [method, routes.length, listRoutes]);

  // Follow a live deposit, so a settled request updates while this page stays open.
  useEffect(() => {
    if (!activeDeposit) return;
    if (activeDeposit.status !== "awaiting_deposit" && activeDeposit.status !== "processing") {
      return;
    }
    const id = activeDeposit._id;
    const poll = () => {
      void syncDeposit({ attemptId: id }).catch((error: unknown) => {
        console.error("deposit_sync_failed", {
          attemptId: id,
          message: error instanceof Error ? error.message : String(error),
        });
      });
    };
    poll();
    const timer = setInterval(poll, DEPOSIT_POLL_MS);
    return () => clearInterval(timer);
  }, [activeDeposit, syncDeposit]);

  const networks = useMemo(() => {
    const seen = new Map<string, string>();
    for (const route of routes) seen.set(route.blockchain, route.network);
    return [...seen].map(([value, name]) => ({ value, name }));
  }, [routes]);

  const tokens = useMemo(
    () =>
      routes
        .filter((route) => route.blockchain === network)
        .map((route) => ({ value: route.assetId, symbol: route.symbol })),
    [routes, network],
  );

  function onNetworkChange(value: string) {
    setNetwork(value);
    setAssetId("");
    setDepositError(null);
  }

  async function connect() {
    if (connecting) return;
    setConnecting(true);
    setStatusMsg(null);
    if (step === "error") setStep("idle");
    try {
      const { connectPayerWallet } = await import("@/lib/wallet-kit");
      const address = await connectPayerWallet();
      setPayerAddress(address);
      console.log("payer_wallet_connected", { address });
    } catch (error) {
      console.error("payer_wallet_connect_failed", {
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setConnecting(false);
    }
  }

  const recordSentPayment = useCallback(
    async (sent: SentPayment) => {
      try {
        const result = await submitDirect({
          publicId,
          payerAddress: sent.payerAddress,
          txHash: sent.hash,
        });
        window.sessionStorage.removeItem(unverifiedPaymentKey(publicId));
        setSentPayment(null);
        setSettledHash(sent.hash);
        setStep("done");
        setStatusMsg(
          result.status === "settled"
            ? "Payment settled on Stellar."
            : "Your payment arrived after this request closed. The recipient still received it.",
        );
      } catch (error) {
        console.error("payment_verification_failed", {
          publicId,
          txHash: sent.hash,
          message: error instanceof Error ? error.message : String(error),
        });
        setSentPayment(sent);
        setStep("error");
        setStatusMsg(unverifiedPaymentMessage(error));
      }
    },
    [publicId, submitDirect],
  );

  async function executePayment() {
    if (payLock.current || !request || !payerAddress || required === null) return;
    payLock.current = true;
    setStep("paying");
    setStatusMsg(null);
    try {
      const [
        { buildUsdcPaymentTx, parseTransaction, transactionHashHex, TX_TIMEOUT_SECONDS },
        kit,
      ] = await Promise.all([import("@/lib/stellar/tx"), import("@/lib/wallet-kit")]);
      const account = await fetchAccountState(payerAddress);
      if (!account.sequence) throw new Error("This wallet doesn't have a Stellar account yet.");

      const tx = buildUsdcPaymentTx({
        source: payerAddress,
        sequence: account.sequence,
        memo: requestMemo(publicId),
        payments: [{ destination: request.recipientAddress, stroops: required }],
      });
      const signed = await kit.signWithPayerWallet(tx.toXDR(), payerAddress);
      const sent: SentPayment = {
        hash: transactionHashHex(parseTransaction(signed)),
        payerAddress,
        expiresAt: Math.floor(Date.now() / 1000) + TX_TIMEOUT_SECONDS,
      };
      // Saved before submitting. If the response is lost, the payer can't pay twice by accident.
      window.sessionStorage.setItem(unverifiedPaymentKey(publicId), JSON.stringify(sent));
      setSentPayment(sent);
      try {
        await submitEnvelope(signed);
      } catch (error) {
        if (error instanceof StellarSubmitError && !error.indeterminate) {
          window.sessionStorage.removeItem(unverifiedPaymentKey(publicId));
          setSentPayment(null);
          throw error;
        }
        setStep("error");
        setStatusMsg(unverifiedPaymentMessage(error));
        return;
      }
      await recordSentPayment(sent);
    } catch (error) {
      setStep("error");
      setStatusMsg(userFacingError(error, "Payment could not be submitted. Try again."));
    } finally {
      payLock.current = false;
    }
  }

  async function retryVerification() {
    if (!sentPayment || verifying) return;
    setVerifying(true);
    setStatusMsg("Checking your payment…");
    try {
      const found = await fetchTransaction(sentPayment.hash);
      if (!found && Math.floor(Date.now() / 1000) > sentPayment.expiresAt) {
        window.sessionStorage.removeItem(unverifiedPaymentKey(publicId));
        setSentPayment(null);
        setStep("idle");
        setStatusMsg(
          "That payment never reached the network, so nothing was sent. You can pay again.",
        );
        return;
      }
      await recordSentPayment(sentPayment);
    } catch (error) {
      setStatusMsg(unverifiedPaymentMessage(error));
    } finally {
      setVerifying(false);
    }
  }

  async function requestDeposit() {
    if (creatingDeposit || !assetId || !refundTo.trim()) return;
    setCreatingDeposit(true);
    setDepositError(null);
    try {
      const id = await createDeposit({ publicId, originAsset: assetId, refundTo: refundTo.trim() });
      window.sessionStorage.setItem(trackedDepositKey(publicId), id);
      setDepositId(id);
    } catch (error) {
      setDepositError(
        userFacingError(error, "No route is available for this token. Try another one."),
      );
    } finally {
      setCreatingDeposit(false);
    }
  }

  function clearDeposit() {
    window.sessionStorage.removeItem(trackedDepositKey(publicId));
    setDepositId(null);
    setDepositError(null);
  }

  const paymentInProgress = request?.status === "pending" && !activeDeposit && !sentPayment;
  const canPay =
    request?.status === "open" &&
    !legacyRequest &&
    recipientReady &&
    directBalance === "ready" &&
    !sentPayment &&
    !verifying &&
    step !== "paying" &&
    step !== "done";

  return {
    request,
    attempts,
    legacyRequest,
    recipientReady,
    recipientChecked: recipientAccount.isSuccess,
    method,
    setMethod,
    payerAddress,
    connecting,
    connect,
    directBalance,
    canPay,
    step,
    statusMsg,
    settledHash,
    paymentSent: Boolean(sentPayment),
    pendingHash: sentPayment?.hash ?? null,
    checkingPayment: verifying,
    paymentInProgress: Boolean(paymentInProgress),
    executePayment,
    retryVerification,
    networks,
    tokens,
    routesError,
    network,
    onNetworkChange,
    assetId,
    setAssetId,
    refundTo,
    setRefundTo,
    creatingDeposit,
    depositError,
    activeDeposit,
    requestDeposit,
    clearDeposit,
  };
}
