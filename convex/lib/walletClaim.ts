import { recoverMessageAddress, type Hex } from "viem";

export const WALLET_CLAIM_PREFIX = "Sandia wallet claim";

export function walletClaimMessage(nonce: string): string {
  return `${WALLET_CLAIM_PREFIX}\n${nonce}`;
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function signClaimNonce(
  subject: string,
  expiresAt: number,
  secret: string,
): Promise<string> {
  const payload = `${subject}.${expiresAt}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return `${payload}.${bytesToHex(new Uint8Array(sig))}`;
}

export async function assertClaimNonce(
  subject: string,
  nonce: string,
  secret: string,
  now: number,
): Promise<void> {
  const parts = nonce.split(".");
  if (parts.length !== 3) throw new Error("Wallet claim expired. Request a new signature.");
  const [nonceSubject, expRaw, mac] = parts;
  if (nonceSubject !== subject) throw new Error("Wallet claim does not match this session");
  const expiresAt = Number(expRaw);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) {
    throw new Error("Wallet claim expired. Request a new signature.");
  }
  const expected = await signClaimNonce(subject, expiresAt, secret);
  if (expected !== `${nonceSubject}.${expRaw}.${mac}`) {
    throw new Error("Wallet claim could not be verified");
  }
}

export async function recoverClaimAddress(nonce: string, signature: string): Promise<string> {
  const recovered = await recoverMessageAddress({
    message: walletClaimMessage(nonce),
    signature: signature as Hex,
  });
  return recovered.toLowerCase();
}

export function assertLinkTargets(input: {
  currentUserId: string;
  subjectOwnerId?: string;
  accountOwnerId?: string;
}): void {
  if (input.subjectOwnerId && input.subjectOwnerId !== input.currentUserId) {
    throw new Error("This sign-in is already linked to another account");
  }
  if (input.accountOwnerId && input.accountOwnerId !== input.currentUserId) {
    throw new Error("This smart account is already linked to another account");
  }
}
