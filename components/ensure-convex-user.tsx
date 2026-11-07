"use client";

import { useEffect, useRef } from "react";
import { useConvexAuth, useAction, useMutation, useQuery } from "convex/react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/convex/_generated/api";
import { walletClaimHash } from "@/convex/lib/walletClaim";
import { useAppAuth } from "@/lib/auth-bridge";
import { stellarAccountKey } from "@/lib/stellar/use-account";
import { useStellarSigner } from "@/lib/stellar/use-signer";
import { useSignedInWallet } from "@/lib/use-signed-in-wallet";

const ACTIVATION_ATTEMPTS = 3;

/**
 * Finishes account setup after sign-in. First it links the embedded wallet to the Convex user with
 * one signature. Then it activates the account: the sponsor pays for the account and USDC trustline.
 */
export function EnsureConvexUser({
  attempt,
  onFailed,
}: {
  attempt: number;
  onFailed: (failed: boolean) => void;
}) {
  const { ready, authenticated, email } = useAppAuth();
  const { isAuthenticated } = useConvexAuth();
  const { address } = useSignedInWallet();
  const signHash = useStellarSigner(address);
  const issueNonce = useMutation(api.users.issueNonce);
  const storeUser = useMutation(api.users.store);
  const prepareActivation = useAction(api.stellarSponsor.prepareActivation);
  const submitActivation = useAction(api.stellarSponsor.submitActivation);
  const queryClient = useQueryClient();
  const me = useQuery(api.users.me, ready && authenticated && isAuthenticated ? {} : "skip");
  const claiming = useRef(false);
  const activating = useRef<string | null>(null);

  useEffect(() => {
    if (!ready || !authenticated || !isAuthenticated || !address) return;
    if (me === undefined) return;
    if (me && me.address === address) return;
    if (claiming.current) return;

    claiming.current = true;
    void (async () => {
      try {
        const nonce = await issueNonce({});
        const signature = await signHash(await walletClaimHash(nonce));
        await storeUser({ address, nonce, signature, ...(email ? { email } : {}) });
        console.log("payment_wallet_claimed", { address });
      } catch (error) {
        onFailed(true);
        console.error("wallet_claim_failed", {
          address,
          message: error instanceof Error ? error.message : "Could not confirm this wallet",
        });
      } finally {
        claiming.current = false;
      }
    })();
  }, [
    ready,
    authenticated,
    isAuthenticated,
    address,
    me,
    email,
    issueNonce,
    storeUser,
    signHash,
    onFailed,
    attempt,
  ]);

  useEffect(() => {
    if (!address || me?.address !== address) return;
    const key = `${address}:${attempt}`;
    if (activating.current === key) return;
    activating.current = key;

    void (async () => {
      try {
        for (let tries = 1; tries <= ACTIVATION_ATTEMPTS; tries++) {
          // Each try depends on the last: a sequence clash needs a fresh transaction.
          // react-doctor-disable-next-line react-doctor/async-await-in-loop
          const prepared = await prepareActivation({});
          if (prepared.status === "active") break;

          // The SDK is large, so it loads only for the one setup that needs it.
          // react-doctor-disable-next-line react-doctor/async-await-in-loop
          const [{ parseTransaction, signWith }, { assertActivationTx }] = await Promise.all([
            import("@/lib/stellar/tx"),
            import("@/lib/stellar/policy"),
          ]);
          const tx = parseTransaction(prepared.xdr);
          assertActivationTx(tx, address);
          // react-doctor-disable-next-line react-doctor/async-await-in-loop
          const xdr = await signWith(tx, address, signHash);
          // react-doctor-disable-next-line react-doctor/async-await-in-loop
          const submitted = await submitActivation({ xdr });
          if (submitted.ok) break;
          if (tries === ACTIVATION_ATTEMPTS) throw new Error(submitted.message);
        }
        onFailed(false);
        await queryClient.invalidateQueries({ queryKey: stellarAccountKey(address) });
      } catch (error) {
        activating.current = null;
        onFailed(true);
        console.error("stellar_activation_failed", {
          address,
          message: error instanceof Error ? error.message : "Could not set up this wallet",
        });
      }
    })();
  }, [
    address,
    me?.address,
    attempt,
    prepareActivation,
    submitActivation,
    signHash,
    queryClient,
    onFailed,
  ]);

  return null;
}
