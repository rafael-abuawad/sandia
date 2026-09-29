"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { LoginButton } from "@/components/login-button";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { useSignedInWallet } from "@/lib/use-signed-in-wallet";
import ActivityLoading, { ActivityListSkeleton } from "./loading";

const KIND_LABEL: Record<string, string> = {
  request: "Request",
  send: "Send",
  swap: "Stock",
  vault: "Earn",
};

export default function ActivityPage() {
  const { ready, isSignedIn } = useSignedInWallet();
  const items = useQuery(api.activity.listMine, isSignedIn ? {} : "skip");

  if (!ready) return <ActivityLoading />;

  if (!isSignedIn) {
    return (
      <div className="pr-page">
        <div className="space-y-2">
          <h1 className="pr-display text-2xl">Activity</h1>
          <p className="text-sm leading-relaxed text-muted">
            Payment requests, USDG sends, stock fills, and vault actions for this account show up
            here.
          </p>
        </div>
        <div className="pr-panel pr-panel--padded flex flex-col items-center gap-3">
          <LoginButton />
          <p className="text-center text-sm text-muted">
            Sign in to see requests, sends, stocks, and vault activity.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="pr-page pr-page--wide space-y-4">
      <h1 className="pr-display text-2xl">Activity</h1>
      {items === undefined ? <ActivityListSkeleton /> : null}
      {items && items.length === 0 ? (
        <div className="pr-panel pr-panel--padded space-y-3">
          <p className="font-medium">No activity yet</p>
          <p className="text-sm text-muted">
            Payment requests, USDG sends, stock fills, and vault actions for this account show up
            here. Guests who only pay a link do not get a history.
          </p>
          <Button asChild>
            <Link href="/requests/new">Create a request</Link>
          </Button>
        </div>
      ) : null}
      <ul className="space-y-2">
        {items?.map((item: { id: string; kind: string; title: string; status: string }) => (
          <li
            key={item.id}
            className="pr-panel flex items-center justify-between gap-3 px-4 py-3 text-sm"
          >
            <div>
              <p className="font-medium">{KIND_LABEL[item.kind] ?? "Activity"}</p>
              <p className="text-muted">{item.title}</p>
            </div>
            <StatusBadge status={item.status} />
          </li>
        ))}
      </ul>
    </div>
  );
}
