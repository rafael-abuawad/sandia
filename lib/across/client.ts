const ACROSS_API = "https://app.across.to/api";

export type AcrossChain = {
  chainId: number;
  name: string;
  publicRpcUrl?: string;
  explorerUrl?: string;
  logoUrl?: string;
};

export type AcrossToken = {
  chainId: number;
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoUrl?: string;
  priceUsd?: string;
};

export type AcrossApprovalTxn = {
  chainId: number;
  to: string;
  data: string;
};

export type AcrossAmountCheck = {
  token?: string;
  spender?: string;
  actual?: string;
  expected?: string;
};

export type AcrossQuoteChecks = {
  allowance?: AcrossAmountCheck;
  balance?: AcrossAmountCheck;
};

function checkIsShort(check: AcrossAmountCheck | undefined): boolean {
  if (check?.actual == null || check.expected == null) return false;
  try {
    return BigInt(check.actual) < BigInt(check.expected);
  } catch {
    return false;
  }
}

/** Why an Across quote cannot be executed yet. Allowance-only gaps are fixed by the approval step. */
export function quoteFundingGap(quote: { checks?: unknown }): "balance" | "allowance" | null {
  if (!quote.checks || typeof quote.checks !== "object") return null;
  const checks = quote.checks as AcrossQuoteChecks;
  if (checkIsShort(checks.balance)) return "balance";
  if (checkIsShort(checks.allowance)) return "allowance";
  return null;
}

export type AcrossSwapQuote = {
  id?: string;
  crossSwapType?: string;
  approvalTxns?: AcrossApprovalTxn[];
  checks?: AcrossQuoteChecks;
  fees?: {
    total?: { amount?: string; amountUsd?: string; token?: string };
    totalMax?: { amount?: string; amountUsd?: string };
    originGas?: unknown;
  };
  inputAmount?: string;
  maxInputAmount?: string;
  expectedOutputAmount?: string;
  minOutputAmount?: string;
  expectedFillTime?: number;
  quoteExpiryTimestamp?: number;
  swapTx?: {
    chainId: number;
    to: string;
    data: string;
    value?: string;
    gas?: string | number;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
    simulationSuccess?: boolean;
  };
  error?: string;
  message?: string;
};

async function acrossGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${ACROSS_API}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, v);
    }
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Across API ${path} failed (${res.status}): ${text}`);
  }
  return (await res.json()) as T;
}

export async function fetchAcrossChains(): Promise<AcrossChain[]> {
  return acrossGet<AcrossChain[]>("/swap/chains");
}

export async function fetchAcrossTokens(chainId?: number): Promise<AcrossToken[]> {
  return acrossGet<AcrossToken[]>(
    "/swap/tokens",
    chainId !== undefined ? { chainId: String(chainId) } : undefined,
  );
}

export async function fetchSwapApproval(params: {
  tradeType: "exactInput" | "minOutput" | "exactOutput";
  amount: string;
  inputToken: string;
  outputToken: string;
  originChainId: number;
  destinationChainId: number;
  depositor: string;
  recipient: string;
  slippage?: string;
  integratorId?: string;
}): Promise<AcrossSwapQuote> {
  const query: Record<string, string> = {
    tradeType: params.tradeType,
    amount: params.amount,
    inputToken: params.inputToken,
    outputToken: params.outputToken,
    originChainId: String(params.originChainId),
    destinationChainId: String(params.destinationChainId),
    depositor: params.depositor,
    recipient: params.recipient,
    slippage: params.slippage ?? "auto",
  };
  if (params.integratorId) {
    query.integratorId = params.integratorId;
  }

  const url = new URL(`${ACROSS_API}/swap/approval`);
  for (const [k, v] of Object.entries(query)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    let detail = `Across quote failed (${res.status})`;
    try {
      const errBody = (await res.json()) as AcrossSwapQuote;
      detail = errBody.message || errBody.error || detail;
    } catch {
      // keep status fallback when body isn't JSON
    }
    throw new Error(detail);
  }
  const data = (await res.json()) as AcrossSwapQuote;
  if (!data.swapTx) {
    throw new Error(data.message || data.error || "No executable quote for this route");
  }
  return data;
}

/**
 * Prefer exactOutput so recipient gets the requested amount.
 * Fall back to minOutput if exactOutput is unsupported for the route.
 */
export async function quoteExactOutputWithFallback(params: {
  amount: string;
  inputToken: string;
  outputToken: string;
  originChainId: number;
  destinationChainId: number;
  depositor: string;
  recipient: string;
  integratorId?: string;
}): Promise<{ quote: AcrossSwapQuote; tradeType: "exactOutput" | "minOutput" }> {
  try {
    const quote = await fetchSwapApproval({
      ...params,
      tradeType: "exactOutput",
      slippage: "auto",
    });
    return { quote, tradeType: "exactOutput" };
  } catch (exactErr) {
    try {
      const quote = await fetchSwapApproval({
        ...params,
        tradeType: "minOutput",
        slippage: "auto",
      });
      return { quote, tradeType: "minOutput" };
    } catch {
      throw exactErr instanceof Error
        ? exactErr
        : new Error("No valid Across route for this payment");
    }
  }
}
