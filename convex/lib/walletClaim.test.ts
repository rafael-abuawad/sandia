import { ed25519 } from "@noble/curves/ed25519";
import { Keypair } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";
import {
  assertClaimNonce,
  assertLinkTargets,
  signClaimNonce,
  verifyWalletClaim,
  walletClaimHash,
} from "./walletClaim";

const SECRET = "test-secret";

function toHex(bytes: Uint8Array): string {
  return `0x${[...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

describe("wallet claim", () => {
  it("round-trips a nonce and rejects another subject or an old nonce", async () => {
    const now = Date.now();
    const nonce = await signClaimNonce("did:1", now + 1000, SECRET);
    await expect(assertClaimNonce("did:1", nonce, SECRET, now)).resolves.toBeUndefined();
    await expect(assertClaimNonce("did:2", nonce, SECRET, now)).rejects.toThrow("does not match");
    await expect(assertClaimNonce("did:1", nonce, SECRET, now + 2000)).rejects.toThrow("expired");
  });

  it("accepts the wallet's Ed25519 signature over the claim hash", async () => {
    const keypair = Keypair.random();
    const nonce = await signClaimNonce("did:1", Date.now() + 1000, SECRET);
    const hash = await walletClaimHash(nonce);
    const signature = keypair.sign(Buffer.from(hash.slice(2), "hex"));
    await expect(verifyWalletClaim(keypair.publicKey(), nonce, toHex(signature))).resolves.toBe(
      true,
    );
  });

  it("rejects another wallet, another nonce, and bad input", async () => {
    const keypair = Keypair.random();
    const other = Keypair.random();
    const nonce = await signClaimNonce("did:1", Date.now() + 1000, SECRET);
    const hash = await walletClaimHash(nonce);
    const signature = toHex(keypair.sign(Buffer.from(hash.slice(2), "hex")));
    await expect(verifyWalletClaim(other.publicKey(), nonce, signature)).resolves.toBe(false);
    await expect(verifyWalletClaim(keypair.publicKey(), `${nonce}x`, signature)).resolves.toBe(
      false,
    );
    await expect(verifyWalletClaim(`0x${"1".repeat(40)}`, nonce, signature)).resolves.toBe(false);
    await expect(verifyWalletClaim(keypair.publicKey(), nonce, "0x1234")).resolves.toBe(false);
  });

  it("uses the same curve the Stellar SDK signs with", () => {
    const keypair = Keypair.random();
    const message = new Uint8Array(32).fill(7);
    expect(
      ed25519.verify(keypair.sign(Buffer.from(message)), message, keypair.rawPublicKey()),
    ).toBe(true);
  });

  it("guards account links", () => {
    expect(() => assertLinkTargets({ currentUserId: "a", subjectOwnerId: "b" })).toThrow(
      "already linked",
    );
    expect(() => assertLinkTargets({ currentUserId: "a", accountOwnerId: "a" })).not.toThrow();
  });
});
