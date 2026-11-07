import { Keypair } from "@stellar/stellar-sdk";
import { describe, expect, it, vi } from "vitest";
import type { ReviewPayload } from "@/components/send-form/state";
import { parseAccountState, type StellarAccountState } from "@/lib/stellar/horizon";
import { STELLAR_USDC } from "@/lib/stellar/constants";
import { parseTransaction, transactionHashHex } from "@/lib/stellar/tx";
import {
  callsForReview,
  executeSend,
  SendPendingError,
  type SendDependencies,
  type SubmittedSendTransaction,
} from "./execute";

const user = Keypair.random();
const account = user.publicKey();
const alice = Keypair.random().publicKey();
const bob = Keypair.random().publicKey();

const review: ReviewPayload = {
  mode: "single",
  recipients: [{ address: alice, amountUsdMicros: 1_000_000 }],
  totalUsdMicros: 1_000_000,
};

function funded(balance = "100.0000000"): StellarAccountState {
  return parseAccountState({
    sequence: "7",
    balances: [
      {
        asset_type: "credit_alphanum4",
        asset_code: "USDC",
        asset_issuer: STELLAR_USDC.issuer,
        balance,
      },
    ],
  });
}

const missing: StellarAccountState = {
  exists: false,
  hasUsdcTrustline: false,
  usdcBalance: 0n,
  memoRequired: false,
  sequence: null,
};

function deps(overrides: Partial<SendDependencies> = {}): SendDependencies {
  return {
    loadAccount: vi.fn(async () => funded()),
    lookupTransaction: vi.fn(async () => null),
    sign: vi.fn(async (hash: string) =>
      Buffer.from(user.sign(Buffer.from(hash, "hex"))).toString("hex"),
    ),
    submit: vi.fn(async () => ({ ok: true as const, hash: "f".repeat(64) })),
    ...overrides,
  };
}

function run(
  overrides: Partial<SendDependencies> = {},
  input: { review?: ReviewPayload; pending?: SubmittedSendTransaction | null; now?: number } = {},
) {
  const dependencies = deps(overrides);
  const onSubmitted = vi.fn();
  const onCleared = vi.fn();
  const onAwaiting = vi.fn();
  const promise = executeSend({
    review: input.review ?? review,
    account,
    pending: input.pending ?? null,
    deps: dependencies,
    now: input.now === undefined ? undefined : () => input.now as number,
    onAwaiting,
    onSubmitted,
    onCleared,
  });
  return { promise, dependencies, onSubmitted, onCleared, onAwaiting };
}

describe("executeSend", () => {
  it("signs, submits, and scales amounts to 7 decimals", async () => {
    const { promise, dependencies, onSubmitted } = run();
    const result = await promise;
    expect(result.hash).toBe("f".repeat(64));
    expect(result.calls).toEqual([{ recipient: alice, amount: 10_000_000n }]);

    const xdr = vi.mocked(dependencies.submit).mock.calls[0][0];
    const tx = parseTransaction(xdr);
    expect(tx.signatures).toHaveLength(1);
    expect(tx.operations).toHaveLength(1);
    expect(onSubmitted).toHaveBeenCalledWith(
      expect.objectContaining({ hash: transactionHashHex(tx), stage: "transfer" }),
    );
  });

  it("puts a batch in one transaction", async () => {
    const batch: ReviewPayload = {
      mode: "massive",
      recipients: [
        { address: alice, amountUsdMicros: 1_000_000 },
        { address: bob, amountUsdMicros: 2_000_000 },
      ],
      totalUsdMicros: 3_000_000,
    };
    const { promise, dependencies } = run({}, { review: batch });
    await promise;
    expect(dependencies.submit).toHaveBeenCalledTimes(1);
    const tx = parseTransaction(vi.mocked(dependencies.submit).mock.calls[0][0]);
    expect(tx.operations).toHaveLength(2);
  });

  it("stops before signing when the wallet is short", async () => {
    const { promise, dependencies } = run({ loadAccount: vi.fn(async () => funded("0.5000000")) });
    await expect(promise).rejects.toThrow("enough USDC");
    expect(dependencies.sign).not.toHaveBeenCalled();
  });

  it("stops before signing when a recipient can't receive USDC", async () => {
    const noTrustline = parseAccountState({ sequence: "1", balances: [] });
    const { promise, dependencies } = run({
      loadAccount: vi.fn(async (address: string) => (address === account ? funded() : noTrustline)),
    });
    await expect(promise).rejects.toThrow("hasn't enabled USDC");
    expect(dependencies.sign).not.toHaveBeenCalled();
  });

  it("reports a recipient without an account", async () => {
    const { promise } = run({
      loadAccount: vi.fn(async (address: string) => (address === account ? funded() : missing)),
    });
    await expect(promise).rejects.toThrow("doesn't have a Stellar account");
  });

  it("requires a memo when the recipient demands one", async () => {
    const memoRequired = { ...funded(), memoRequired: true };
    const loadAccount = vi.fn(async (address: string) =>
      address === account ? funded() : memoRequired,
    );
    await expect(run({ loadAccount }).promise).rejects.toThrow("requires a memo");
    await expect(
      run({ loadAccount }, { review: { ...review, memo: "123" } }).promise,
    ).resolves.toBeTruthy();
  });

  it("clears after a definite rejection", async () => {
    const { promise, onCleared } = run({
      submit: vi.fn(async () => ({
        ok: false as const,
        message: "A recipient hasn't enabled USDC on their Stellar account.",
        indeterminate: false,
      })),
    });
    await expect(promise).rejects.toThrow("hasn't enabled USDC");
    expect(onCleared).toHaveBeenCalled();
  });

  it("stays pending when the outcome is unknown", async () => {
    const { promise, onCleared } = run({
      submit: vi.fn(async () => ({
        ok: false as const,
        message: "The Stellar network didn't respond in time.",
        indeterminate: true,
      })),
    });
    await expect(promise).rejects.toBeInstanceOf(SendPendingError);
    expect(onCleared).not.toHaveBeenCalled();
  });

  describe("status check for a pending send", () => {
    const pending: SubmittedSendTransaction = {
      hash: "a".repeat(64),
      stage: "transfer",
      label: "Confirm",
      expiresAt: 1000,
    };

    it("never signs again while the first transaction may land", async () => {
      const { promise, dependencies } = run({}, { pending, now: 999 });
      await expect(promise).rejects.toBeInstanceOf(SendPendingError);
      expect(dependencies.sign).not.toHaveBeenCalled();
    });

    it("finishes when the transaction landed", async () => {
      const { promise } = run(
        {
          lookupTransaction: vi.fn(async () => ({
            hash: "b".repeat(64),
            successful: true,
            created_at: "",
            source_account: account,
          })),
        },
        { pending, now: 999 },
      );
      await expect(promise).resolves.toMatchObject({ hash: "b".repeat(64) });
    });

    it("clears once the transaction can no longer land", async () => {
      const { promise, onCleared, dependencies } = run({}, { pending, now: 1001 });
      await expect(promise).rejects.toThrow("expired");
      expect(onCleared).toHaveBeenCalled();
      expect(dependencies.sign).not.toHaveBeenCalled();
    });

    it("reports a failed transaction", async () => {
      const { promise, onCleared } = run(
        {
          lookupTransaction: vi.fn(async () => ({
            hash: pending.hash,
            successful: false,
            created_at: "",
            source_account: account,
          })),
        },
        { pending, now: 999 },
      );
      await expect(promise).rejects.toThrow("failed");
      expect(onCleared).toHaveBeenCalled();
    });
  });

  it("refuses to start over while only the activity update is left", async () => {
    const { promise } = run(
      {},
      { pending: { hash: "a".repeat(64), stage: "activity", label: "Updating" } },
    );
    await expect(promise).rejects.toThrow("Retry its activity update");
  });
});

describe("callsForReview", () => {
  it("converts to stroops", () => {
    expect(callsForReview(review)).toEqual([{ recipient: alice, amount: 10_000_000n }]);
  });
});
