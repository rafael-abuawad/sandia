"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectKitProvider } from "connectkit";
import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";
import { createConfig, http, useAccount, useDisconnect, WagmiProvider } from "wagmi";
import { injected } from "wagmi/connectors";
import { zeroDevWallet } from "@zerodev/wallet-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { appChains, robinhoodChain } from "@/lib/chains";
import { passkeyRpId } from "@/lib/sandia-auth";
import { AuthBridgeProvider } from "@/lib/auth-bridge";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const zeroDevProjectId = process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID;

const cutoverConfig = createConfig({
  chains: appChains,
  connectors: [
    ...(zeroDevProjectId
      ? [
          zeroDevWallet({
            projectId: zeroDevProjectId,
            chains: [robinhoodChain],
            mode: "4337",
            rpId: passkeyRpId(),
          }),
        ]
      : []),
    injected(),
  ],
  transports: Object.fromEntries(appChains.map((chain) => [chain.id, http()])) as Record<
    (typeof appChains)[number]["id"],
    ReturnType<typeof http>
  >,
  ssr: true,
});

function ZerodevBridge({ children }: { children: React.ReactNode }) {
  const { isConnected } = useAccount();
  const { disconnectAsync } = useDisconnect();
  return (
    <AuthBridgeProvider
      value={{
        ready: true,
        authenticated: isConnected,
        login: () => undefined,
        logout: async () => {
          await disconnectAsync();
        },
      }}
    >
      {children}
    </AuthBridgeProvider>
  );
}

function useCutoverAuth() {
  return {
    isLoading: false,
    isAuthenticated: false,
    fetchAccessToken: async () => null,
  };
}

export function ZerodevProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [convex] = useState(() => (convexUrl ? new ConvexReactClient(convexUrl) : null));

  if (!convex) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center">
        <p className="text-sm text-muted">Set NEXT_PUBLIC_CONVEX_URL before using Sandia auth.</p>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={cutoverConfig}>
        <ConnectKitProvider
          mode="light"
          options={{ enforceSupportedChains: false, initialChainId: robinhoodChain.id }}
        >
          <ConvexProviderWithAuth client={convex} useAuth={useCutoverAuth}>
            <TooltipProvider delayDuration={200}>
              <ZerodevBridge>{children}</ZerodevBridge>
            </TooltipProvider>
          </ConvexProviderWithAuth>
        </ConnectKitProvider>
      </WagmiProvider>
    </QueryClientProvider>
  );
}
