"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useAppAuth } from "@/lib/auth-bridge";
import { stellarWalletAddress } from "@/lib/wallet-setup";

/** Session plus the Privy embedded Stellar wallet used for the signed-in account. */
export function useSignedInWallet() {
  const { ready, authenticated } = useAppAuth();
  const { user } = usePrivy();
  const address = authenticated ? stellarWalletAddress(user?.linkedAccounts) : undefined;

  return {
    ready,
    authenticated,
    address,
    isConnected: Boolean(address),
    isSignedIn: Boolean(ready && authenticated && address),
  };
}
