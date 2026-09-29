import { secp256k1 } from "@noble/curves/secp256k1";
import { getAddress, hashMessage, hexToNumber, keccak256, size, type Hex } from "viem";

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

function toRecoveryBit(yParityOrV: number): number {
  if (yParityOrV === 0 || yParityOrV === 1) return yParityOrV;
  if (yParityOrV === 27) return 0;
  if (yParityOrV === 28) return 1;
  throw new Error("Invalid signature");
}

/**
 * Recover the signer of an EIP-191 personal_sign message.
 * viem's recoverMessageAddress dynamically imports @noble/curves, which the Convex runtime rejects.
 */
export async function recoverClaimAddress(nonce: string, signature: string): Promise<string> {
  const signatureHex = signature as Hex;
  if (size(signatureHex) !== 65) throw new Error("Invalid signature");
  const hash = hashMessage(walletClaimMessage(nonce));
  const yParityOrV = hexToNumber(`0x${signatureHex.slice(130)}`);
  const publicKey = secp256k1.Signature.fromCompact(signatureHex.slice(2, 130))
    .addRecoveryBit(toRecoveryBit(yParityOrV))
    .recoverPublicKey(hash.slice(2))
    .toHex(false);
  const addressHash = keccak256(`0x${publicKey.slice(2)}`);
  return getAddress(`0x${addressHash.slice(-40)}`).toLowerCase();
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
