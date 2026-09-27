/** Native ETH sentinel used by the 0x Swap API. */
export const NATIVE_ETH = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

export type EthSwapQuote = {
  maxSellAmount: string;
  buyAmount: string;
  transaction: {
    to: string;
    data: string;
    value: string;
    gas?: string;
  };
};

const ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const CALLDATA = /^0x[a-fA-F0-9]+$/;
const UINT = /^\d+$/;

const NO_ROUTE = "No route is available for this token. Try another one.";

function uintString(value: unknown): string | null {
  if (typeof value === "string" && UINT.test(value)) return value;
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return String(value);
  return null;
}

/** Firm 0x exact-buy quote. Rejects indicative prices and any buy amount other than the request. */
export function parseEthSwapQuote(body: unknown, expectedBuyAmount: string): EthSwapQuote {
  if (!body || typeof body !== "object") throw new Error(NO_ROUTE);
  const quote = body as Record<string, unknown>;
  if (quote.liquidityAvailable === false) throw new Error(NO_ROUTE);

  const buyAmount = uintString(quote.buyAmount);
  const maxSellAmount = uintString(quote.maxSellAmount);
  if (
    !buyAmount ||
    !UINT.test(expectedBuyAmount) ||
    BigInt(buyAmount) !== BigInt(expectedBuyAmount)
  ) {
    throw new Error("The quote did not deliver the requested USDG amount.");
  }
  if (!maxSellAmount || BigInt(maxSellAmount) <= 0n) throw new Error(NO_ROUTE);

  const tx = quote.transaction;
  if (!tx || typeof tx !== "object") throw new Error(NO_ROUTE);
  const transaction = tx as Record<string, unknown>;
  const to = transaction.to;
  const data = transaction.data;
  const value = uintString(transaction.value);
  if (typeof to !== "string" || !ADDRESS.test(to)) throw new Error(NO_ROUTE);
  if (typeof data !== "string" || !CALLDATA.test(data) || data === "0x") throw new Error(NO_ROUTE);
  if (!value || BigInt(value) <= 0n) throw new Error(NO_ROUTE);

  const gas = uintString(transaction.gas);
  const gasText = gas && BigInt(gas) > 0n ? gas : undefined;
  return {
    maxSellAmount,
    buyAmount,
    transaction: {
      to,
      data,
      value,
      ...(gasText ? { gas: gasText } : {}),
    },
  };
}

/** ETH the wallet must hold before gas. Uses the higher of the sell ceiling and the transaction value. */
export function ethSpendBaseUnits(quote: EthSwapQuote): bigint {
  const ceiling = BigInt(quote.maxSellAmount);
  const value = BigInt(quote.transaction.value);
  return value > ceiling ? value : ceiling;
}
