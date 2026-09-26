"use client";

import { getEmbeddedConnectedWallet, useWallets } from "@privy-io/react-auth";
import { useAccount } from "wagmi";
import { useAppAuth } from "@/lib/auth-bridge";

/** Session plus the Privy embedded wallet used for the signed-in account. */
export function useSignedInWallet() {
  const { ready, authenticated } = useAppAuth();
  const { wallets } = useWallets();
  const { address, isConnected, chainId, connector } = useAccount();
  const embedded = getEmbeddedConnectedWallet(wallets);
  const activeIsEmbedded = Boolean(
    address && embedded && address.toLowerCase() === embedded.address.toLowerCase(),
  );

  return {
    ready,
    authenticated,
    address: activeIsEmbedded ? address : undefined,
    chainId: activeIsEmbedded ? chainId : undefined,
    connectorId: activeIsEmbedded ? connector?.id : undefined,
    isConnected: Boolean(activeIsEmbedded && isConnected),
    isSignedIn: Boolean(ready && authenticated && activeIsEmbedded),
  };
}
