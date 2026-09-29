import { decodeEventLog, type Address, type Log } from "viem";
import { VAULT_ADDRESS, vaultAbi } from "./vault-calls";

export type VaultActivityKind = "deposit" | "withdraw" | "redeem";

export type VaultReceiptMatch =
  | { ok: true; assets: bigint; shares: bigint }
  | { ok: false; reason: string };

type ExpectedVaultReceipt = {
  kind: VaultActivityKind;
  account: Address;
  assets: bigint;
  shares?: bigint;
};

function sameAddress(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

/** Confirm a Steakhouse deposit or exit from the vault logs on a successful receipt. */
export function matchVaultReceipt(logs: Log[], expected: ExpectedVaultReceipt): VaultReceiptMatch {
  const decoded = logs.flatMap((log) => {
    if (!sameAddress(log.address, VAULT_ADDRESS)) return [];
    try {
      const event = decodeEventLog({ abi: vaultAbi, data: log.data, topics: log.topics });
      return event.eventName === "Deposit" || event.eventName === "Withdraw" ? [event] : [];
    } catch {
      return [];
    }
  });

  if (expected.kind === "deposit") {
    const deposit = decoded.find(
      (event) =>
        event.eventName === "Deposit" &&
        sameAddress(event.args.onBehalf, expected.account) &&
        event.args.assets === expected.assets,
    );
    if (!deposit || deposit.eventName !== "Deposit") {
      return { ok: false, reason: "The receipt did not deposit this amount." };
    }
    return { ok: true, assets: deposit.args.assets, shares: deposit.args.shares };
  }

  const exit = decoded.find((event) => {
    if (event.eventName !== "Withdraw") return false;
    if (!sameAddress(event.args.receiver, expected.account)) return false;
    if (!sameAddress(event.args.onBehalf, expected.account)) return false;
    if (expected.kind === "redeem") return event.args.shares === expected.shares;
    return event.args.assets === expected.assets;
  });
  if (!exit || exit.eventName !== "Withdraw") {
    return {
      ok: false,
      reason:
        expected.kind === "redeem"
          ? "The receipt did not redeem this position."
          : "The receipt did not withdraw this amount.",
    };
  }
  return { ok: true, assets: exit.args.assets, shares: exit.args.shares };
}
