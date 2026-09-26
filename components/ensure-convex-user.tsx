"use client";

import { useEffect, useRef } from "react";
import { getEmbeddedConnectedWallet, useWallets } from "@privy-io/react-auth";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useAccount, useSignMessage } from "wagmi";
import { api } from "@/convex/_generated/api";
import { walletClaimMessage } from "@/convex/lib/walletClaim";
import { useAppAuth } from "@/lib/auth-bridge";

/** Links the signed-in Privy embedded wallet to a Convex user after one claim signature. */
export function EnsureConvexUser() {
  const { ready, authenticated, email } = useAppAuth();
  const { isAuthenticated } = useConvexAuth();
  const { wallets } = useWallets();
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const issueNonce = useMutation(api.users.issueNonce);
  const storeUser = useMutation(api.users.store);
  const me = useQuery(api.users.me, ready && authenticated && isAuthenticated ? {} : "skip");
  const claiming = useRef(false);
  const embeddedAddress = getEmbeddedConnectedWallet(wallets)?.address;

  useEffect(() => {
    if (!ready || !authenticated || !isAuthenticated || !address || !embeddedAddress) return;
    if (address.toLowerCase() !== embeddedAddress.toLowerCase()) return;
    if (me === undefined) return;
    if (me && me.address.toLowerCase() === address.toLowerCase()) return;
    if (claiming.current) return;

    claiming.current = true;
    void (async () => {
      try {
        const nonce = await issueNonce({});
        const signature = await signMessageAsync({ message: walletClaimMessage(nonce) });
        await storeUser({
          address,
          nonce,
          signature,
          ...(email ? { email } : {}),
        });
        console.log("payment_wallet_claimed", { address });
      } catch (error) {
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
    embeddedAddress,
    me,
    email,
    issueNonce,
    storeUser,
    signMessageAsync,
  ]);

  return null;
}
