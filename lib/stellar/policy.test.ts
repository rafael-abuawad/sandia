import {
  Account,
  Asset,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
  type Transaction,
} from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";
import { STELLAR_USDC } from "./constants";
import { assertActivationTx, assertSignedBySource, assertSponsorable } from "./policy";
import { buildUsdcPaymentTx, USDC_ASSET } from "./tx";

const user = Keypair.random();
const other = Keypair.random();
const sponsor = Keypair.random();
const address = user.publicKey();

function builder(source = address, fee = "100") {
  return new TransactionBuilder(new Account(source, "1"), {
    fee,
    networkPassphrase: Networks.PUBLIC,
  });
}

function usdcSend(count = 1): Transaction {
  return buildUsdcPaymentTx({
    source: address,
    sequence: "1",
    payments: Array.from({ length: count }, () => ({
      destination: other.publicKey(),
      stroops: 10_000_000n,
    })),
  });
}

describe("assertSponsorable", () => {
  it("allows USDC sends up to a full batch", () => {
    expect(() => assertSponsorable(usdcSend(), address)).not.toThrow();
    expect(() => assertSponsorable(usdcSend(100), address)).not.toThrow();
  });

  it("rejects another wallet's transaction", () => {
    expect(() => assertSponsorable(usdcSend(), other.publicKey())).toThrow(
      "isn't from your wallet",
    );
  });

  it("rejects other assets and non-payment operations", () => {
    const xlm = builder()
      .addOperation(
        Operation.payment({
          destination: other.publicKey(),
          asset: Asset.native(),
          amount: "1",
        }),
      )
      .setTimeout(60)
      .build();
    expect(() => assertSponsorable(xlm, address)).toThrow("Only USDC");

    const merge = builder()
      .addOperation(Operation.accountMerge({ destination: other.publicKey() }))
      .setTimeout(60)
      .build();
    expect(() => assertSponsorable(merge, address)).toThrow("Only USDC");

    const fakeUsdc = builder()
      .addOperation(
        Operation.payment({
          destination: other.publicKey(),
          asset: new Asset("USDC", other.publicKey()),
          amount: "1",
        }),
      )
      .setTimeout(60)
      .build();
    expect(() => assertSponsorable(fakeUsdc, address)).toThrow("Only USDC");
  });

  it("rejects an operation sourced from another account", () => {
    const tx = builder()
      .addOperation(
        Operation.payment({
          destination: address,
          asset: USDC_ASSET,
          amount: "1",
          source: other.publicKey(),
        }),
      )
      .setTimeout(60)
      .build();
    expect(() => assertSponsorable(tx, address)).toThrow("come from this wallet");
  });

  it("rejects a long-lived or excessively priced transaction", () => {
    const longLived = builder()
      .addOperation(
        Operation.payment({ destination: other.publicKey(), asset: USDC_ASSET, amount: "1" }),
      )
      .setTimeout(3600)
      .build();
    expect(() => assertSponsorable(longLived, address)).toThrow("five minutes");

    const pricey = builder(address, "30000000")
      .addOperation(
        Operation.payment({ destination: other.publicKey(), asset: USDC_ASSET, amount: "1" }),
      )
      .setTimeout(60)
      .build();
    expect(() => assertSponsorable(pricey, address)).toThrow("fee is too high");
  });

  it("rejects contract calls", () => {
    const call = builder()
      .addOperation(
        Operation.invokeContractFunction({
          contract: STELLAR_USDC.contractId,
          function: "transfer",
          args: [],
        }),
      )
      .setTimeout(60)
      .build();
    expect(() => assertSponsorable(call, address)).toThrow("Only USDC payments");
  });
});

describe("assertSignedBySource", () => {
  it("requires the source's signature", () => {
    const tx = usdcSend();
    expect(() => assertSignedBySource(tx, address)).toThrow("isn't signed");
    tx.sign(other);
    expect(() => assertSignedBySource(tx, address)).toThrow("isn't signed");
    tx.sign(user);
    expect(() => assertSignedBySource(tx, address)).not.toThrow();
  });
});

describe("assertActivationTx", () => {
  function activation(create: boolean, sponsored = address, line = USDC_ASSET) {
    const tx = builder(sponsor.publicKey()).addOperation(
      Operation.beginSponsoringFutureReserves({ sponsoredId: sponsored }),
    );
    if (create) {
      tx.addOperation(Operation.createAccount({ destination: sponsored, startingBalance: "0" }));
    }
    return tx
      .addOperation(Operation.changeTrust({ asset: line, source: sponsored }))
      .addOperation(Operation.endSponsoringFutureReserves({ source: sponsored }))
      .setTimeout(60)
      .build();
  }

  it("accepts account setup, with or without creating the account", () => {
    expect(() => assertActivationTx(activation(true), address)).not.toThrow();
    expect(() => assertActivationTx(activation(false), address, sponsor.publicKey())).not.toThrow();
  });

  it("rejects setup for someone else or another asset", () => {
    expect(() => assertActivationTx(activation(true, other.publicKey()), address)).toThrow();
    expect(() =>
      assertActivationTx(activation(false, address, new Asset("USDC", other.publicKey())), address),
    ).toThrow();
  });

  it("rejects a funded create, which would move the sponsor's XLM", () => {
    const tx = builder(sponsor.publicKey())
      .addOperation(Operation.beginSponsoringFutureReserves({ sponsoredId: address }))
      .addOperation(Operation.createAccount({ destination: address, startingBalance: "100" }))
      .addOperation(Operation.changeTrust({ asset: USDC_ASSET, source: address }))
      .addOperation(Operation.endSponsoringFutureReserves({ source: address }))
      .setTimeout(60)
      .build();
    expect(() => assertActivationTx(tx, address)).toThrow();
  });

  it("rejects an extra operation that drains the user", () => {
    const tx = builder(sponsor.publicKey())
      .addOperation(Operation.beginSponsoringFutureReserves({ sponsoredId: address }))
      .addOperation(
        Operation.payment({
          destination: other.publicKey(),
          asset: USDC_ASSET,
          amount: "1",
          source: address,
        }),
      )
      .addOperation(Operation.endSponsoringFutureReserves({ source: address }))
      .setTimeout(60)
      .build();
    expect(() => assertActivationTx(tx, address)).toThrow();
  });
});
