import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { describe, expect, it } from "vitest";
import {
  assertClaimNonce,
  assertLinkTargets,
  recoverClaimAddress,
  signClaimNonce,
  walletClaimMessage,
} from "./walletClaim";

describe("wallet claim", () => {
  it("recovers the signer of a claim message", async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const nonce = await signClaimNonce(account.address, Date.now() + 60_000, "secret");
    const signature = await account.signMessage({ message: walletClaimMessage(nonce) });
    await assertClaimNonce(account.address, nonce, "secret", Date.now());
    expect(await recoverClaimAddress(nonce, signature)).toBe(account.address.toLowerCase());
  });

  it("refuses a subject or smart account owned by someone else", () => {
    expect(() =>
      assertLinkTargets({
        currentUserId: "user-a",
        subjectOwnerId: "user-b",
      }),
    ).toThrow(/another account/);
    expect(() =>
      assertLinkTargets({
        currentUserId: "user-a",
        accountOwnerId: "user-b",
      }),
    ).toThrow(/smart account/);
  });
});
