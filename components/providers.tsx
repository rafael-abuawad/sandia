"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PrivyProvider } from "@privy-io/react-auth";
import { WagmiProvider } from "@privy-io/wagmi";
import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";
import { useState } from "react";
import { EnsureConvexUser } from "@/components/ensure-convex-user";
import { useConvexPrivyAuth } from "@/lib/convex-privy-auth";
import { privyConfig } from "@/lib/privy-config";
import { wagmiConfig } from "@/lib/wagmi-config";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [convex] = useState(() => (convexUrl ? new ConvexReactClient(convexUrl) : null));

  if (!privyAppId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center text-foreground">
        <div className="max-w-md space-y-3">
          <h1 className="pr-brand text-2xl">Payrequest</h1>
          <p className="text-sm text-muted">
            Set <code className="text-[var(--accent-ink)]">NEXT_PUBLIC_PRIVY_APP_ID</code> in{" "}
            <code className="text-[var(--accent-ink)]">.env.local</code> from the{" "}
            <a
              className="underline underline-offset-2"
              href="https://dashboard.privy.io"
              target="_blank"
              rel="noreferrer"
            >
              Privy dashboard
            </a>
            .
          </p>
        </div>
      </div>
    );
  }

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
    <PrivyProvider appId={privyAppId} config={privyConfig}>
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
          <ConvexProviderWithAuth client={convex} useAuth={useConvexPrivyAuth}>
            <EnsureConvexUser />
            {children}
          </ConvexProviderWithAuth>
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
