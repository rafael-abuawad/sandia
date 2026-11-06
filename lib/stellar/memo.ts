const MAX_MEMO_TEXT_BYTES = 28;

/** Numeric memos are sent as MEMO_ID when they fit in 64 bits, because exchanges expect that. */
export function isMemoId(memo: string): boolean {
  return /^\d{1,20}$/.test(memo) && BigInt(memo) <= 18_446_744_073_709_551_615n;
}

export function memoError(memo: string): string | null {
  if (!memo) return null;
  if (isMemoId(memo)) return null;
  if (new TextEncoder().encode(memo).length > MAX_MEMO_TEXT_BYTES) {
    return "A memo can be at most 28 bytes.";
  }
  return null;
}

/** Binds a direct payment to a request, so an unrelated earlier payment can't settle it. */
export function requestMemo(publicId: string): string {
  return `sandia:${publicId}`;
}
