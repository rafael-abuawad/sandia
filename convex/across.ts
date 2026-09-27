"use node";

import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { createPublicClient, http, type Hex } from "viem";
import { arbitrum, avalanche, base, bsc, mainnet, monad, optimism, polygon } from "viem/chains";
import { matchDepositToRequest, parseDepositLogs } from "./lib/depositLog";
import { RECONCILE_BATCH } from "./lib/fillProof";
import { matchTransferToPayment, parseTransferLogs } from "./lib/transferLog";

const ACROSS_API = "https://app.across.to/api";
const FETCH_TIMEOUT_MS = 8_000;

const robinhoodChain = {
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mainnet.chain.robinhood.com"] } },
} as const;

const chainsById = new Map<
  number,
  { id: number; name: string; rpcUrls: { default: { http: readonly string[] } } }
>(
  [mainnet, optimism, bsc, polygon, monad, base, arbitrum, avalanche, robinhoodChain].map(
    (chain) => [chain.id, chain],
  ),
);

type AcrossDepositRecord = {
  status?: string;
  fillTxnRef?: string;
  fillTx?: string;
  destinationChainId?: number;
  originChainId?: number;
  depositTxnRef?: string;
  depositTxHash?: string;
  recipient?: string;
  outputToken?: string;
  outputAmount?: string;
};

function acrossHeaders(): HeadersInit {
  const headers: Record<string, string> = { Accept: "application/json" };
  const key = process.env.ACROSS_API_KEY;
  if (key) headers.Authorization = `Bearer ${key}`;
  return headers;
}

async function acrossGet(path: string, params: Record<string, string>): Promise<unknown> {
  const url = new URL(`${ACROSS_API}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  const res = await fetch(url, {
    headers: acrossHeaders(),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Across ${path} failed (${res.status}): ${text.slice(0, 180)}`);
  }
  return await res.json();
}

function asRecord(value: unknown): AcrossDepositRecord | null {
  if (!value || typeof value !== "object") return null;
  return value as AcrossDepositRecord;
}

/** `/deposit` carries recipient, token, and amount. `/deposit/status` does not. */
export async function fetchDepositProof(depositTxnRef: string): Promise<AcrossDepositRecord> {
  const single = await acrossGet("/deposit", { depositTxnRef });
  const record = asRecord(single);
  if (record?.status) return record;

  const list = await acrossGet("/deposits", { depositTxHash: depositTxnRef });
  const rows = Array.isArray(list)
    ? list
    : list && typeof list === "object" && Array.isArray((list as { deposits?: unknown[] }).deposits)
      ? (list as { deposits: unknown[] }).deposits
      : [];
  const match = rows
    .map(asRecord)
    .find(
      (row) =>
        row?.depositTxHash?.toLowerCase() === depositTxnRef.toLowerCase() ||
        row?.depositTxnRef?.toLowerCase() === depositTxnRef.toLowerCase(),
    );
  if (!match) {
    throw new Error("Across has not indexed this deposit yet");
  }
  return match;
}

async function readOriginDeposit(originChainId: number, depositTxnRef: string) {
  const chain = chainsById.get(originChainId);
  const rpc = chain?.rpcUrls.default.http[0];
  if (!chain || !rpc) {
    throw new Error("This origin chain is not supported for payment verification");
  }
  const client = createPublicClient({
    chain: chain as typeof mainnet,
    transport: http(rpc),
  });
  const receipt = await client.getTransactionReceipt({ hash: depositTxnRef as Hex });
  if (receipt.status !== "success") {
    throw new Error("Deposit transaction reverted");
  }
  return parseDepositLogs(receipt.logs);
}

async function readDirectProof(
  txHash: string,
  expected: { token: string; recipient: string; amount: string },
): Promise<AcrossDepositRecord> {
  const client = createPublicClient({
    chain: robinhoodChain,
    transport: http(robinhoodChain.rpcUrls.default.http[0]),
  });
  const receipt = await client.getTransactionReceipt({ hash: txHash as Hex });
  const transfers = receipt.status === "success" ? parseTransferLogs(receipt.logs) : [];
  const matched = matchTransferToPayment(transfers, expected);
  if (!matched.ok) {
    return {
      status: "filled",
      fillTxnRef: txHash,
      destinationChainId: 4663,
      outputToken: expected.token,
      recipient: "0x0000000000000000000000000000000000000000",
      outputAmount: "0",
    };
  }
  return {
    status: "filled",
    fillTxnRef: txHash,
    destinationChainId: 4663,
    outputToken: expected.token,
    recipient: expected.recipient,
    outputAmount: matched.amount.toString(),
  };
}

export const submitDeposit = action({
  args: {
    publicId: v.string(),
    payerAddress: v.string(),
    originChainId: v.number(),
    inputToken: v.string(),
    quotedInputAmount: v.string(),
    expectedOutputAmount: v.string(),
    minOutputAmount: v.string(),
    feesJson: v.string(),
    quoteId: v.optional(v.string()),
    depositTxnRef: v.string(),
  },
  returns: v.object({
    attemptId: v.optional(v.string()),
    duplicate: v.boolean(),
  }),
  handler: async (ctx, args): Promise<{ attemptId?: string; duplicate: boolean }> => {
    const request = await ctx.runQuery(internal.paymentRequests.getInternalByPublicId, {
      publicId: args.publicId,
    });
    if (!request) throw new Error("Payment request not found");

    const deposits = await readOriginDeposit(args.originChainId, args.depositTxnRef);
    const matched = matchDepositToRequest(deposits, {
      destinationChainId: request.destinationChainId,
      destinationTokenAddress: request.destinationTokenAddress,
      recipientAddress: request.recipientAddress,
      outputAmountBaseUnits: request.outputAmountBaseUnits,
    });
    if (!matched.ok) {
      console.error("payment_deposit_rejected", {
        publicId: args.publicId,
        depositTxnRef: args.depositTxnRef.toLowerCase(),
        reason: matched.reason,
      });
      throw new Error(matched.reason);
    }

    const saved = await ctx.runMutation(internal.paymentAttempts.acceptVerifiedDeposit, {
      ...args,
      settlementKind: "across",
    });
    if (saved.expired) {
      throw new Error("Payment request is expired");
    }
    return {
      attemptId: saved.attemptId,
      duplicate: saved.duplicate,
    };
  },
});

export const quoteSwap = action({
  args: {
    publicId: v.string(),
    inputToken: v.string(),
    originChainId: v.number(),
    depositor: v.string(),
    tradeType: v.union(v.literal("exactOutput"), v.literal("minOutput")),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const request = await ctx.runQuery(internal.paymentRequests.getInternalByPublicId, {
      publicId: args.publicId,
    });
    if (!request) throw new Error("Payment request not found");
    if (request.status !== "open" && request.status !== "pending") {
      throw new Error("Payment request is not payable");
    }

    const params: Record<string, string> = {
      tradeType: args.tradeType,
      amount: request.outputAmountBaseUnits,
      inputToken: args.inputToken,
      outputToken: request.destinationTokenAddress,
      originChainId: String(args.originChainId),
      destinationChainId: String(request.destinationChainId),
      depositor: args.depositor,
      recipient: request.recipientAddress,
      slippage: "auto",
    };
    const integratorId =
      process.env.ACROSS_INTEGRATOR_ID ?? process.env.NEXT_PUBLIC_ACROSS_INTEGRATOR_ID;
    if (integratorId) params.integratorId = integratorId;

    const quote = (await acrossGet("/swap/approval", params)) as {
      swapTx?: { simulationSuccess?: boolean };
      checks?: {
        balance?: { actual?: string; expected?: string };
        allowance?: { actual?: string; expected?: string };
      };
      message?: string;
      error?: string;
    };
    if (!quote.swapTx) {
      throw new Error(quote.message || quote.error || "No executable quote for this route");
    }
    if (quote.swapTx.simulationSuccess === false) {
      console.warn("across_quote_simulation_failed", {
        originChainId: args.originChainId,
        tradeType: args.tradeType,
        balanceActual: quote.checks?.balance?.actual,
        balanceExpected: quote.checks?.balance?.expected,
        allowanceActual: quote.checks?.allowance?.actual,
        allowanceExpected: quote.checks?.allowance?.expected,
      });
    }
    return quote;
  },
});

function proofArgs(
  depositTxnRef: string,
  record: AcrossDepositRecord | null,
  transportError: boolean,
) {
  return {
    depositTxnRef,
    acrossStatus: (record?.status ?? "pending").toLowerCase(),
    fillTxnRef: record?.fillTxnRef ?? record?.fillTx,
    destinationChainId: record?.destinationChainId,
    outputToken: record?.outputToken,
    recipient: record?.recipient,
    outputAmount: record?.outputAmount,
    transportError,
  };
}

export const syncDepositStatus = action({
  args: { depositTxnRef: v.string() },
  returns: v.object({
    acrossStatus: v.string(),
    fillTxnRef: v.optional(v.string()),
    requestStatus: v.string(),
    attemptStatus: v.string(),
    reason: v.optional(v.string()),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    acrossStatus: string;
    fillTxnRef?: string;
    requestStatus: string;
    attemptStatus: string;
    reason?: string;
  }> => {
    const depositTxnRef = args.depositTxnRef.toLowerCase();
    try {
      const record = await fetchDepositProof(depositTxnRef);
      const result = await ctx.runMutation(
        internal.paymentAttempts.applyAcrossStatus,
        proofArgs(depositTxnRef, record, false),
      );
      return {
        acrossStatus: (record.status ?? result.attemptStatus).toLowerCase(),
        fillTxnRef: record.fillTxnRef ?? record.fillTx,
        requestStatus: result.requestStatus,
        attemptStatus: result.attemptStatus,
        reason: result.reason,
      };
    } catch (error) {
      console.error("payment_status_fetch_failed", {
        depositTxnRef,
        message: error instanceof Error ? error.message : "Unknown error",
      });
      const result = await ctx.runMutation(
        internal.paymentAttempts.applyAcrossStatus,
        proofArgs(depositTxnRef, null, true),
      );
      return {
        acrossStatus: result.attemptStatus,
        requestStatus: result.requestStatus,
        attemptStatus: result.attemptStatus,
        reason: result.reason,
      };
    }
  },
});

export const reconcilePending = internalAction({
  args: {},
  returns: v.object({ checked: v.number(), errors: v.number() }),
  handler: async (ctx): Promise<{ checked: number; errors: number }> => {
    await ctx.runMutation(internal.paymentRequests.expireDueRequests, {});
    const attempts = await ctx.runQuery(internal.paymentAttempts.listForReconciliation, {
      limit: RECONCILE_BATCH,
    });
    let errors = 0;
    for (const attempt of attempts) {
      try {
        const record =
          attempt.settlementKind === "direct"
            ? await readDirectProof(attempt.depositTxnRef, {
                token: attempt.destinationTokenAddress,
                recipient: attempt.recipientAddress,
                amount: attempt.outputAmountBaseUnits,
              })
            : await fetchDepositProof(attempt.depositTxnRef);
        await ctx.runMutation(
          internal.paymentAttempts.applyAcrossStatus,
          proofArgs(attempt.depositTxnRef, record, false),
        );
      } catch (error) {
        errors += 1;
        console.error("payment_status_fetch_failed", {
          publicId: attempt.publicId,
          depositTxnRef: attempt.depositTxnRef,
          message: error instanceof Error ? error.message : "Unknown error",
        });
        await ctx.runMutation(
          internal.paymentAttempts.applyAcrossStatus,
          proofArgs(attempt.depositTxnRef, null, true),
        );
      }
    }
    await ctx.runAction(internal.outboundActions.reconcile, {});
    return { checked: attempts.length, errors };
  },
});
