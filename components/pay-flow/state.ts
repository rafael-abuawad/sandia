import type { Hex } from "viem";
import type { AcrossChain, AcrossToken, AcrossSwapQuote } from "@/lib/across/client";
import type { EthSwapQuote } from "@/lib/zerox-quote";

export type PayStep = "idle" | "quoting" | "approving" | "paying" | "tracking" | "done" | "error";

export type AcrossDepositDetails = {
  originChainId: number;
  inputToken: string;
  quotedInputAmount: string;
  expectedOutputAmount: string;
  minOutputAmount: string;
  feesJson: string;
  quoteId?: string;
};

/** A payment transaction the wallet already sent. It must be verified, never paid again. */
export type SentPayment = {
  hash: Hex;
  chainId: number;
  payerAddress: string;
} & ({ kind: "across"; details: AcrossDepositDetails } | { kind: "direct" } | { kind: "eth" });

export type PayFlowState = {
  chains: AcrossChain[];
  tokens: AcrossToken[];
  originChainId: number | null;
  inputToken: string;
  quote: AcrossSwapQuote | null;
  ethQuote: EthSwapQuote | null;
  tradeType: "exactOutput" | "minOutput" | null;
  quoteError: string | null;
  step: PayStep;
  statusMsg: string | null;
  depositTxnRef: string | null;
  pendingTx: Hex | undefined;
  unverifiedPayment: SentPayment | null;
};

export const initialPayFlowState: PayFlowState = {
  chains: [],
  tokens: [],
  originChainId: null,
  inputToken: "",
  quote: null,
  ethQuote: null,
  tradeType: null,
  quoteError: null,
  step: "idle",
  statusMsg: null,
  depositTxnRef: null,
  pendingTx: undefined,
  unverifiedPayment: null,
};

export type PayFlowAction =
  | {
      type: "routesLoaded";
      chains: AcrossChain[];
      tokens: AcrossToken[];
    }
  | { type: "routesFailed"; error: string }
  | { type: "preferOriginChain"; chainId: number }
  | { type: "originChainChanged"; chainId: number }
  | {
      type: "inputTokenChanged";
      token: string;
      nextStep: "quoting" | "idle";
    }
  | { type: "clearInvalidToken" }
  | { type: "quoteStarted" }
  | {
      type: "quoteSucceeded";
      quote: AcrossSwapQuote;
      tradeType: "exactOutput" | "minOutput";
    }
  | { type: "ethQuoteSucceeded"; quote: EthSwapQuote }
  | { type: "quoteFailed"; error: string }
  | { type: "stepChanged"; step: PayStep }
  | { type: "statusChanged"; message: string | null }
  | { type: "depositTracked"; depositTxnRef: string; message?: string }
  | { type: "pendingTxSet"; hash: Hex }
  | { type: "paymentFailed"; message: string }
  | { type: "paymentUnverified"; payment: SentPayment; message: string }
  | { type: "paymentDone"; message?: string };

export function payFlowReducer(state: PayFlowState, action: PayFlowAction): PayFlowState {
  switch (action.type) {
    case "routesLoaded":
      return {
        ...state,
        chains: action.chains,
        tokens: action.tokens,
      };
    case "routesFailed":
      return { ...state, quoteError: action.error };
    case "preferOriginChain":
      if (state.originChainId !== null) return state;
      return { ...state, originChainId: action.chainId };
    case "originChainChanged":
      return {
        ...state,
        originChainId: action.chainId,
        inputToken: "",
        quote: null,
        ethQuote: null,
        quoteError: null,
        tradeType: null,
        step: "idle",
      };
    case "inputTokenChanged":
      return {
        ...state,
        inputToken: action.token,
        quote: null,
        ethQuote: null,
        quoteError: null,
        tradeType: null,
        step: action.nextStep,
      };
    case "clearInvalidToken":
      return {
        ...state,
        inputToken: "",
        quote: null,
        ethQuote: null,
        quoteError: null,
      };
    case "quoteStarted":
      return {
        ...state,
        step: "quoting",
        quoteError: null,
        quote: null,
        ethQuote: null,
      };
    case "quoteSucceeded":
      return {
        ...state,
        quote: action.quote,
        ethQuote: null,
        tradeType: action.tradeType,
        step: "idle",
        quoteError: null,
      };
    case "ethQuoteSucceeded":
      return {
        ...state,
        quote: null,
        ethQuote: action.quote,
        tradeType: null,
        step: "idle",
        quoteError: null,
      };
    case "quoteFailed":
      return {
        ...state,
        quote: null,
        ethQuote: null,
        quoteError: action.error,
        step: "error",
      };
    case "stepChanged":
      return { ...state, step: action.step };
    case "statusChanged":
      return { ...state, statusMsg: action.message };
    case "depositTracked":
      return {
        ...state,
        depositTxnRef: action.depositTxnRef,
        step: "tracking",
        statusMsg: action.message ?? state.statusMsg,
        unverifiedPayment: null,
      };
    case "pendingTxSet":
      return { ...state, pendingTx: action.hash };
    case "paymentFailed":
      return {
        ...state,
        step: "error",
        statusMsg: action.message,
      };
    case "paymentUnverified":
      return {
        ...state,
        step: "error",
        statusMsg: action.message,
        unverifiedPayment: action.payment,
      };
    case "paymentDone":
      return {
        ...state,
        step: "done",
        statusMsg: action.message ?? state.statusMsg,
      };
    default:
      return state;
  }
}
