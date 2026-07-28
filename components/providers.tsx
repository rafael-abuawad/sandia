"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { ConnectKitProvider, getDefaultConfig } from "connectkit";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { useState } from "react";
import { AuthProvider } from "@/components/auth-provider";
import { appChains } from "@/lib/chains";

const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "00000000000000000000000000000000";

const wagmiConfig = createConfig(
  getDefaultConfig({
    appName: "Payrequest",
    appDescription: "USD payment requests settled as stablecoins on Robinhood Chain via Across",
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    walletConnectProjectId,
    chains: [...appChains],
    transports: Object.fromEntries(appChains.map((chain) => [chain.id, http()])) as Record<
      number,
      ReturnType<typeof http>
    >,
  }),
);

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

export function Providers({
  children,
  initialSessionToken = null,
}: {
  children: React.ReactNode;
  initialSessionToken?: string | null;
}) {
  const [queryClient] = useState(() => new QueryClient());
  const [convex] = useState(() => (convexUrl ? new ConvexReactClient(convexUrl) : null));

  if (!convex) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center text-foreground">
        <div className="max-w-md space-y-3">
          <h1 className="pr-brand text-2xl">Payrequest</h1>
          <p className="text-sm text-muted">
            Set <code className="text-[var(--accent-ink)]">NEXT_PUBLIC_CONVEX_URL</code> in{" "}
            <code className="text-[var(--accent-ink)]">.env.local</code> after running{" "}
            <code className="text-[var(--accent-ink)]">npx convex dev</code>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider
          theme="soft"
          mode="light"
          options={{
            enforceSupportedChains: false,
            initialChainId: 0,
          }}
        >
          <ConvexProvider client={convex}>
            <AuthProvider initialSessionToken={initialSessionToken}>{children}</AuthProvider>
          </ConvexProvider>
        </ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
