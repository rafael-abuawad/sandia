import { encodeAbiParameters, encodeEventTopics, type Log } from "viem";
import { describe, expect, it } from "vitest";
import { VAULT_ADDRESS, vaultAbi } from "./vault-calls";
import { matchVaultReceipt } from "./vault-receipt";

const account = "0x1111111111111111111111111111111111111111";
const other = "0x2222222222222222222222222222222222222222";

function vaultLog(
  eventName: "Deposit" | "Withdraw",
  args: {
    sender: `0x${string}`;
    onBehalf: `0x${string}`;
    receiver?: `0x${string}`;
    assets: bigint;
    shares: bigint;
  },
): Log {
  const topics = encodeEventTopics({
    abi: vaultAbi,
    eventName,
    args:
      eventName === "Deposit"
        ? { sender: args.sender, onBehalf: args.onBehalf }
        : {
            sender: args.sender,
            receiver: args.receiver ?? args.onBehalf,
            onBehalf: args.onBehalf,
          },
  });
  const data = encodeAbiParameters(
    [{ type: "uint256" }, { type: "uint256" }],
    [args.assets, args.shares],
  );
  return { address: VAULT_ADDRESS, topics, data } as unknown as Log;
}

describe("matchVaultReceipt", () => {
  it("accepts a deposit for this account and amount", () => {
    const matched = matchVaultReceipt(
      [
        vaultLog("Deposit", {
          sender: account,
          onBehalf: account,
          assets: 1_000_000n,
          shares: 900_000n,
        }),
      ],
      { kind: "deposit", account, assets: 1_000_000n },
    );
    expect(matched).toEqual({ ok: true, assets: 1_000_000n, shares: 900_000n });
  });

  it("rejects a deposit for another account", () => {
    const matched = matchVaultReceipt(
      [
        vaultLog("Deposit", {
          sender: account,
          onBehalf: other,
          assets: 1_000_000n,
          shares: 900_000n,
        }),
      ],
      { kind: "deposit", account, assets: 1_000_000n },
    );
    expect(matched.ok).toBe(false);
  });

  it("matches a withdraw by assets and a redeem by shares", () => {
    const log = vaultLog("Withdraw", {
      sender: account,
      receiver: account,
      onBehalf: account,
      assets: 2_000_000n,
      shares: 1_800_000n,
    });
    expect(matchVaultReceipt([log], { kind: "withdraw", account, assets: 2_000_000n }).ok).toBe(
      true,
    );
    expect(
      matchVaultReceipt([log], {
        kind: "redeem",
        account,
        assets: 1n,
        shares: 1_800_000n,
      }),
    ).toEqual({ ok: true, assets: 2_000_000n, shares: 1_800_000n });
    expect(matchVaultReceipt([log], { kind: "redeem", account, assets: 1n, shares: 1n }).ok).toBe(
      false,
    );
  });
});
