"use client";

import { useMemo, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SandiaSessionProvider, useSandiaSession } from "@/lib/sandia-session";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

function useSandiaConvexAuth() {
  const { token } = useSandiaSession();
  return useMemo(
    () => ({
      isLoading: false,
      isAuthenticated: token !== null,
      fetchAccessToken: async () => token,
    }),
    [token],
  );
}

function AppProviders({ children }: { children: React.ReactNode }) {
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
    <QueryClientProvider client={queryClient}>
      <ConvexProviderWithAuth client={convex} useAuth={useSandiaConvexAuth}>
        <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
      </ConvexProviderWithAuth>
    </QueryClientProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SandiaSessionProvider>
      <AppProviders>{children}</AppProviders>
    </SandiaSessionProvider>
  );
}
