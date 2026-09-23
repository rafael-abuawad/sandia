"use client";

import { useAccount } from "wagmi";
import { useAppAuth } from "@/lib/auth-bridge";

/** Session plus the active wagmi wallet used for payments. */
export function useSignedInWallet() {
  const { ready, authenticated } = useAppAuth();
  const { address, isConnected, chainId, connector } = useAccount();

  return {
    ready,
    authenticated,
    address,
    chainId,
    connectorId: connector?.id,
    isConnected,
    isSignedIn: Boolean(ready && authenticated && address),
  };
}
