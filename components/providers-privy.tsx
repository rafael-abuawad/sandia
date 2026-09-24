"use client";

import { usePrivy } from "@privy-io/react-auth";
import { WagmiProvider } from "@privy-io/wagmi";
import { AuthBridgeProvider } from "@/lib/auth-bridge";
import { wagmiConfig } from "@/lib/wagmi-config";
import { EnsureConvexUser } from "@/components/ensure-convex-user";

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
      <EnsureConvexUser />
      {children}
    </AuthBridgeProvider>
  );
}

export function PrivyAppProviders({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <PrivyBridge>{children}</PrivyBridge>
    </WagmiProvider>
  );
}
