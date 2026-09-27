const TECHNICAL =
  /\[CONVEX\b|Request ID:|Server Error|Uncaught |Called by client|\bat\s+\S+\.(?:ts|tsx|js|jsx)\b|maxDeposit|Morpho returned/i;

const REPLACEMENTS: Array<[RegExp, string]> = [
  [/^user not found$/i, "Sign in again to continue."],
  [/^not authenticated$/i, "Sign in to continue."],
  [/^unauthorized\b/i, "Sign in to continue."],
  [/^payment request is not payable$/i, "This request can no longer be paid."],
  [/^payment request not found$/i, "This payment request could not be found."],
  [/^no valid route$/i, "No route is available for this token. Try another one."],
  [
    /^no executable quote/i,
    "No route is available for this token. Try another one.",
  ],
  [
    /^route simulation failed\b/i,
    "This route could not be quoted. Try another token.",
  ],
  [
    /0x did not return executable liquidity/i,
    "Trading is unavailable until a quote shows liquidity.",
  ],
  [/^deposits are closed because maxdeposit is 0$/i, "Deposits are closed right now."],
  [/^vault snapshot failed$/i, "Vault details are unavailable right now."],
];

function innerMessage(raw: string): string {
  const uncaught = raw.match(/Uncaught Error:\s*([\s\S]*?)(?:\s+at\s+|$)/i);
  const message = (uncaught?.[1] ?? raw).replace(/\s*Called by client\s*$/i, "").trim();
  return message;
}

/** Product copy for a thrown error. Convex request ids and stack paths never pass through. */
export function userFacingError(error: unknown, fallback: string): string {
  const raw =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const message = innerMessage(raw);
  if (!message || TECHNICAL.test(message)) return fallback;
  for (const [pattern, replacement] of REPLACEMENTS) {
    if (pattern.test(message)) return replacement;
  }
  if (message.length > 180) return fallback;
  return message;
}
