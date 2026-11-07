import { Keypair, type Transaction } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";
import { attachSignature, buildUsdcPaymentTx, parseTransaction, transactionHashHex } from "./tx";

const user = Keypair.random();
const destination = Keypair.random().publicKey();

function tx(memo?: string): Transaction {
  return buildUsdcPaymentTx({
    source: user.publicKey(),
    sequence: "10",
    memo,
    payments: [{ destination, stroops: 125_000_000n }],
  });
}

describe("buildUsdcPaymentTx", () => {
  it("builds a USDC payment with 7-decimal precision and an expiry", () => {
    const built = tx();
    const [operation] = built.operations;
    expect(operation.type).toBe("payment");
    if (operation.type === "payment") {
      expect(operation.amount).toBe("12.5000000");
      expect(operation.destination).toBe(destination);
    }
    expect(Number(built.timeBounds?.maxTime)).toBeGreaterThan(0);
  });

  it("sends numeric memos as MEMO_ID and others as text", () => {
    expect(tx("123456").memo.type).toBe("id");
    expect(tx("sandia:abc").memo.type).toBe("text");
    expect(tx().memo.type).toBe("none");
    expect(() => tx("x".repeat(29))).toThrow("28 bytes");
  });
});

describe("attachSignature", () => {
  it("adds a raw hex signature that verifies and round-trips", () => {
    const built = tx();
    const signature = user.sign(built.hash());
    const hex = `0x${Buffer.from(signature).toString("hex")}`;
    const xdr = attachSignature(built, user.publicKey(), hex);
    const parsed = parseTransaction(xdr);
    expect(transactionHashHex(parsed)).toBe(transactionHashHex(built));
    expect(parsed.signatures).toHaveLength(1);
  });

  it("rejects a signature of the wrong length", () => {
    expect(() => attachSignature(tx(), user.publicKey(), "0x1234")).toThrow("invalid signature");
  });

  it("rejects another key's signature", () => {
    const built = tx();
    const other = Keypair.random();
    const hex = Buffer.from(other.sign(built.hash())).toString("hex");
    expect(() => attachSignature(built, user.publicKey(), hex)).toThrow();
  });
});
