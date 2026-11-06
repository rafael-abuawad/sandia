import { ed25519 } from "@noble/curves/ed25519";
import { accountPublicKey, isStellarAccount } from "../../lib/stellar/strkey";

export const WALLET_CLAIM_PREFIX = "Sandia wallet claim";

export function walletClaimMessage(nonce: string): string {
  return `${WALLET_CLAIM_PREFIX}\n${nonce}`;
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(value: string): Uint8Array {
  const clean = value.startsWith("0x") ? value.slice(2) : value;
  if (clean.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(clean)) {
    throw new Error("Invalid signature");
  }
  return Uint8Array.from(clean.match(/../g) ?? [], (pair) => parseInt(pair, 16));
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

/** The 32-byte hash the embedded wallet signs. Stellar wallets sign raw hashes, not messages. */
export async function walletClaimHash(nonce: string): Promise<`0x${string}`> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(walletClaimMessage(nonce)),
  );
  return `0x${bytesToHex(new Uint8Array(digest))}`;
}

/** Verifies the Ed25519 signature a Stellar `G…` wallet made over the claim hash. */
export async function verifyWalletClaim(
  address: string,
  nonce: string,
  signature: string,
): Promise<boolean> {
  if (!isStellarAccount(address)) return false;
  const signatureBytes = hexToBytes(signature);
  if (signatureBytes.length !== 64) return false;
  const hash = hexToBytes(await walletClaimHash(nonce));
  try {
    return ed25519.verify(signatureBytes, hash, accountPublicKey(address));
  } catch {
    return false;
  }
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
