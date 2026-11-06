import { Keypair, MuxedAccount, Account, StrKey } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";
import {
  accountPublicKey,
  baseAccount,
  isMuxedAccount,
  isStellarAccount,
  isStellarRecipient,
  normalizeRecipient,
} from "./strkey";

const ISSUER = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";

describe("strkey", () => {
  it("agrees with the Stellar SDK on random accounts", () => {
    for (let i = 0; i < 20; i++) {
      const keypair = Keypair.random();
      expect(isStellarAccount(keypair.publicKey())).toBe(true);
      expect(StrKey.isValidEd25519PublicKey(keypair.publicKey())).toBe(true);
      expect([...accountPublicKey(keypair.publicKey())]).toEqual([...keypair.rawPublicKey()]);
    }
  });

  it("rejects a lowercased address, because Stellar addresses are case-sensitive", () => {
    expect(isStellarAccount(ISSUER)).toBe(true);
    expect(isStellarAccount(ISSUER.toLowerCase())).toBe(false);
  });

  it("rejects a bad checksum, wrong type, and EVM addresses", () => {
    expect(isStellarAccount(`${ISSUER.slice(0, -1)}A`)).toBe(false);
    expect(isStellarAccount(Keypair.random().secret())).toBe(false);
    expect(isStellarAccount(`0x${"1".repeat(40)}`)).toBe(false);
    expect(isStellarRecipient("")).toBe(false);
  });

  it("handles muxed addresses and finds their base account", () => {
    const account = Keypair.random().publicKey();
    const muxed = new MuxedAccount(new Account(account, "0"), "42").accountId();
    expect(isMuxedAccount(muxed)).toBe(true);
    expect(isStellarRecipient(muxed)).toBe(true);
    expect(isStellarAccount(muxed)).toBe(false);
    expect(baseAccount(muxed)).toBe(account);
    expect(baseAccount(account)).toBe(account);
  });

  it("normalizes by trimming, never by changing case", () => {
    expect(normalizeRecipient(`  ${ISSUER}\n`)).toBe(ISSUER);
    expect(() => normalizeRecipient(ISSUER.toLowerCase())).toThrow("valid Stellar address");
  });
});
