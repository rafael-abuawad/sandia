"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { LoginButton } from "@/components/login-button";
import { StatusBadge } from "@/components/status-badge";
import { useSignedInWallet } from "@/lib/use-signed-in-wallet";

export default function ActivityPage() {
  const { ready, isSignedIn } = useSignedInWallet();
  const items = useQuery(api.activity.listMine, isSignedIn ? {} : "skip");

  if (!ready) return <p className="text-sm text-muted">Loading…</p>;

  if (!isSignedIn) {
    return (
      <div className="pr-page pr-page--narrow space-y-3 text-center">
        <h1 className="pr-display text-2xl">Activity</h1>
        <p className="text-sm text-muted">Sign in to see requests, sends, swaps, and vault activity.</p>
        <div className="flex justify-center">
          <LoginButton />
        </div>
      </div>
    );
  }

  return (
    <div className="pr-page pr-page--wide space-y-4">
      <h1 className="pr-display text-2xl">Activity</h1>
      {items === undefined ? <p className="text-sm text-muted">Loading…</p> : null}
      {items && items.length === 0 ? (
        <div className="pr-panel pr-panel--padded space-y-2">
          <p className="font-medium">No activity yet</p>
          <p className="text-sm text-muted">
            Payment requests, USDG sends, stock fills, and vault actions for this account show up
            here. Guests who only pay a link do not get a history.
          </p>
          <Link href="/requests/new" className="text-sm underline underline-offset-2">
            Create a request
          </Link>
        </div>
      ) : null}
      <ul className="space-y-2">
        {items?.map((item: { id: string; kind: string; title: string; status: string }) => (
          <li
            key={item.id}
            className="pr-panel flex items-center justify-between gap-3 px-4 py-3 text-sm"
          >
            <div>
              <p className="font-medium capitalize">{item.kind}</p>
              <p className="text-muted">{item.title}</p>
            </div>
            <StatusBadge status={item.status} />
          </li>
        ))}
      </ul>
    </div>
  );
}
