"use client";

import Link from "next/link";
import { usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { LoginButton } from "@/components/login-button";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatUsdFromMicros } from "@/lib/money";
import { useSignedInWallet } from "@/lib/use-signed-in-wallet";
import DashboardLoading from "./loading";

export default function DashboardPage() {
  const { ready, isSignedIn } = useSignedInWallet();
  const {
    results: requests,
    status,
    loadMore,
  } = usePaginatedQuery(api.paymentRequests.listMine, isSignedIn ? {} : "skip", {
    initialNumItems: 20,
  });

  if (!ready) return <DashboardLoading />;

  if (!isSignedIn) {
    return (
      <div className="pr-page pr-page--narrow text-center">
        <h1 className="pr-display text-2xl">Your requests</h1>
        <p className="text-sm text-muted">Sign in to manage payment requests.</p>
        <div className="flex justify-center">
          <LoginButton />
        </div>
      </div>
    );
  }

  return (
    <div className="pr-page pr-page--wide">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="pr-display text-2xl">Your requests</h1>
        <Button asChild className="w-full sm:w-auto">
          <Link href="/requests/new">New request</Link>
        </Button>
      </div>

      {status === "LoadingFirstPage" ? (
        <ul className="space-y-3" role="status" aria-label="Loading" aria-busy="true">
          {["a", "b", "c"].map((row) => (
            <li key={row} className="pr-panel flex items-center justify-between gap-4 px-4 py-4">
              <div className="min-w-0 space-y-1">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-3 w-52" />
              </div>
              <Skeleton className="h-5 w-16 rounded-sm" />
            </li>
          ))}
        </ul>
      ) : null}

      {status !== "LoadingFirstPage" && requests.length === 0 && (
        <div className="pr-panel pr-panel--padded space-y-3 text-center sm:text-left">
          <p className="font-medium text-foreground">No payment requests yet</p>
          <p className="text-sm text-muted">
            Create a USD payment link so payers can settle from their own chain.
          </p>
          <Button asChild className="w-full sm:w-auto">
            <Link href="/requests/new">Create a request</Link>
          </Button>
        </div>
      )}

      <ul className="space-y-3">
        {requests.map(
          (r: {
            _id: string;
            publicId: string;
            amountUsdMicros: number;
            destinationTokenSymbol: string;
            status: string;
          }) => (
            <li key={r._id}>
              <Link
                href={`/requests/${r.publicId}`}
                className="pr-panel flex items-center justify-between gap-4 px-4 py-4 transition-[border-color] duration-[var(--duration)] ease-[var(--ease-out)] hover:border-border-strong"
              >
                <div className="min-w-0 space-y-1">
                  <p className="pr-money font-medium text-foreground">
                    ${formatUsdFromMicros(r.amountUsdMicros)} → {r.destinationTokenSymbol}
                  </p>
                  <p className="truncate text-xs text-muted">/pay/{r.publicId}</p>
                </div>
                <StatusBadge status={r.status} />
              </Link>
            </li>
          ),
        )}
      </ul>
      {status === "CanLoadMore" ? (
        <Button type="button" variant="secondary" onClick={() => loadMore(20)}>
          Load more
        </Button>
      ) : null}
    </div>
  );
}
