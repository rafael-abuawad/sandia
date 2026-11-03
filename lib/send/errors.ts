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

/** Classifies wallet and Hyperliquid errors without exposing raw provider payloads. */
export function sendErrorMessage(error: unknown, fallback = "Send could not be submitted.") {
  const chain = errorChain(error);
  const messages = chain
    .map((item) => (typeof item.message === "string" ? item.message : ""))
    .filter(Boolean);
  const combined = messages.join(" ").toLowerCase();

  if (
    chain.some((item) => item.code === 4001 || item.code === "4001") ||
    /user (rejected|denied)|rejected the request|denied (transaction|message)? ?signature|user cancel/.test(
      combined,
    )
  ) {
    return "You canceled in your wallet. Nothing was sent.";
  }

  if (/insufficient (funds|balance)|exceeds balance/.test(combined)) {
    return "Your USDC balance is too low. Check your balance and try again.";
  }

  if (/not authenticated|unauthorized/.test(combined)) {
    return "Sign in again to continue.";
  }

  if (/timed? ?out|timeout|failed to fetch|fetch failed|network|transport/.test(combined)) {
    return "Hyperliquid is temporarily unreachable. Check your connection and retry.";
  }

  const productError = messages.find((message) =>
    /^(?:Sign in to send USDC\.|Add a recipient\.?|Enable trading first\.|Add USDC to your account first\.)/.test(
      message,
    ),
  );
  if (productError) return productError;

  return fallback;
}
