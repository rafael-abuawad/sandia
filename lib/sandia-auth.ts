/** Flag off keeps Privy and wagmi 3. Flag on is the ZeroDev and ConnectKit cutover. */
export function sandiaAuthMode(): "privy" | "zerodev" {
  return process.env.NEXT_PUBLIC_SANDIA_AUTH === "zerodev" ? "zerodev" : "privy";
}

export function passkeyRpId(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  try {
    return new URL(raw).hostname;
  } catch {
    return "localhost";
  }
}

/**
 * ConnectKit 1.9.2 does not peer React 19 or wagmi 3.
 * Guest pay through its modal stays off until a browser smoke test passes:
 * open the modal, connect an injected wallet, switch chain, and disconnect.
 */
export const CONNECTKIT_SMOKE_PASSED = false;
