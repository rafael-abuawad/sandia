"use client";

import { useEffect, useRef } from "react";
import { getEmbeddedConnectedWallet, usePrivy, useWallets } from "@privy-io/react-auth";
import { useSetActiveWallet } from "@privy-io/wagmi";
import { useAccount } from "wagmi";
import { AuthBridgeProvider } from "@/lib/auth-bridge";
import { EnsureConvexUser } from "@/components/ensure-convex-user";

function EmbeddedWalletPin() {
  const { authenticated } = usePrivy();
  const { wallets } = useWallets();
  const { setActiveWallet } = useSetActiveWallet();
  const { address } = useAccount();
  const activating = useRef<string | null>(null);

  useEffect(() => {
    if (!authenticated) return;
    const wallet = getEmbeddedConnectedWallet(wallets);
    if (!wallet) return;

    const embeddedAddress = wallet.address.toLowerCase();
    if (address?.toLowerCase() === embeddedAddress) {
      activating.current = null;
      return;
    }
    if (activating.current === embeddedAddress) return;

    activating.current = embeddedAddress;
    void setActiveWallet(wallet)
      .then(() => {
        console.log("embedded_wallet_activated", { address: wallet.address });
      })
      .catch((error: unknown) => {
        activating.current = null;
        console.error("embedded_wallet_activate_failed", {
          address: wallet.address,
          message: error instanceof Error ? error.message : "Could not activate embedded wallet",
        });
      });
  }, [authenticated, wallets, address, setActiveWallet]);

  return null;
}

function PrivyBridge({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, login, logout, user } = usePrivy();

  return (
    <AuthBridgeProvider
      value={{
        ready,
        authenticated,
        login,
        logout,
        email: user?.email?.address,
      }}
    >
      <EmbeddedWalletPin />
      <EnsureConvexUser />
      {children}
    </AuthBridgeProvider>
  );
}

export function PrivyAppProviders({ children }: { children: React.ReactNode }) {
  return <PrivyBridge>{children}</PrivyBridge>;
}
