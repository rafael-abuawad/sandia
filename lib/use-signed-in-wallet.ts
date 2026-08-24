"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useAccount } from "wagmi";

/** Privy session plus the active wagmi wallet used for payments. */
export function useSignedInWallet() {
  const { ready, authenticated } = usePrivy();
  const { address, isConnected } = useAccount();

  return {
    ready,
    authenticated,
    address,
    isConnected,
    isSignedIn: Boolean(ready && authenticated && address),
  };
}
