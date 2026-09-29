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
    return "You canceled the send. Your USDG was not sent.";
  }

  if (
    /gas sponsorship|sponsor(?:ship)? (?:is )?(?:not enabled|unavailable)|paymaster/.test(combined)
  ) {
    return "Fee sponsorship is unavailable right now. Your USDG was not sent. Try again later or contact support.";
  }

  if (/insufficient funds for gas|gas balance/.test(combined)) {
    return "The network fee could not be sponsored. Check fee sponsorship and try again later.";
  }

  if (/insufficient funds|exceeds balance/.test(combined)) {
    return "Your USDG balance changed. Check your balance and review the send again.";
  }

  if (/not authenticated|unauthorized/.test(combined)) {
    return "Sign in again to continue.";
  }

  if (/timed? ?out|timeout|failed to fetch|fetch failed|rpc|network|transport/.test(combined)) {
    return "Robinhood Chain is temporarily unavailable. Check your connection and retry.";
  }

  const productError = messages.find((message) =>
    /^(?:Sign in to send USDG\.|Robinhood Chain is not reachable\.|Switch to Robinhood Chain before confirming this send\.|Switch your wallet to Robinhood Chain, then confirm this send\.|Sandia Send is not configured\.|This wallet doesn't have enough USDG on Robinhood Chain\.|USDG approval reverted\.|The transfer reverted on Robinhood Chain\.|The batch transfer reverted on Robinhood Chain\.|USDG approval confirmed, but the batch is not ready yet\.|The wallet did not return a valid transaction hash\.|Add a recipient\.?)/.test(
      message,
    ),
  );
  if (productError) return productError;

  return fallback;
}
