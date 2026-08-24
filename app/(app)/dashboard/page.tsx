"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { ConnectKitButton } from "connectkit";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { formatUsdFromMicros } from "@/lib/money";
import { shortenAddress } from "@/lib/utils";

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const requests = useQuery(
    api.paymentRequests.listMine,
    address ? { creatorAddress: address } : "skip",
  );

  if (!isConnected || !address) {
    return (
      <div className="pr-page pr-page--narrow text-center">
        <h1 className="pr-display text-2xl">Dashboard</h1>
        <p className="text-sm text-muted">Connect your wallet to manage payment requests.</p>
        <div className="flex justify-center">
          <ConnectKitButton />
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

      {requests === undefined && <p className="text-sm text-muted">Loading…</p>}

      {requests && requests.length === 0 && (
        <div className="pr-panel pr-panel--padded space-y-3 text-center sm:text-left">
          <p className="font-medium text-foreground">No payment requests yet</p>
          <p className="text-sm text-muted">
            Create a USD payment link so payers can settle from their own chain — no account
            required for them.
          </p>
          <Button asChild className="w-full sm:w-auto">
            <Link href="/requests/new">Create a request</Link>
          </Button>
        </div>
      )}

      <ul className="space-y-3">
        {requests?.map(
          (r: {
            _id: string;
            publicId: string;
            amountUsdMicros: number;
            destinationTokenSymbol: string;
            recipientAddress: string;
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
                  <p className="truncate text-xs text-muted">
                    To {shortenAddress(r.recipientAddress, 5)} · /pay/{r.publicId}
                  </p>
                </div>
                <StatusBadge status={r.status} />
              </Link>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
