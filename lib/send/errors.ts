type ErrorLike = {
  code?: unknown;
  message?: unknown;
  cause?: unknown;
  error?: unknown;
};

function errorChain(error: unknown): ErrorLike[] {
  const chain: ErrorLike[] = [];
  const seen = new Set<unknown>();
  let current: unknown = error;

  while (current && typeof current === "object" && !seen.has(current) && chain.length < 6) {
    seen.add(current);
    const item = current as ErrorLike;
    chain.push(item);
    current = item.cause ?? item.error;
  }

  return chain;
}

const PRODUCT_ERRORS =
  /^(?:Sign in to send USDC\.|Your wallet is still being set up\.|This wallet doesn't have enough USDC\.|A recipient|Another transaction|This transaction|This send expired|This transfer is confirmed\.|The send failed|The Stellar network|The wallet returned|Add a recipient\.?|Too many transactions|Fee sponsorship|.+ doesn't have a Stellar account yet\.|.+ hasn't enabled USDC|.+ requires a memo)/;

/** Classifies wallet errors without exposing raw provider payloads to the user. */
export function sendErrorMessage(error: unknown, fallback = "Send could not be submitted.") {
  const chain = errorChain(error);
  const messages = chain
    .map((item) => (typeof item.message === "string" ? item.message : ""))
    .filter(Boolean);
  const combined = messages.join(" ").toLowerCase();

  if (
    chain.some((item) => item.code === 4001 || item.code === "4001") ||
    /user (rejected|denied)|rejected the request|denied transaction signature/.test(combined)
  ) {
    return "You canceled the send. Your USDC was not sent.";
  }

  if (/fee sponsorship/.test(combined)) {
    return "Fee sponsorship is unavailable right now. Your USDC was not sent. Try again later or contact support.";
  }

  if (/not authenticated|unauthorized/.test(combined)) {
    return "Sign in again to continue.";
  }

  const productError = messages.find((message) => PRODUCT_ERRORS.test(message));
  if (productError) return productError;

  if (/timed? ?out|timeout|failed to fetch|fetch failed|network|transport/.test(combined)) {
    return "The Stellar network is temporarily unavailable. Check your connection and retry.";
  }

  return fallback;
}
