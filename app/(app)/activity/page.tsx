"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "convex/react";
import { ArrowDownLeft, ArrowUpRight, CandlestickChart, Link2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { LoginButton } from "@/components/login-button";
import { StatusBadge } from "@/components/status-badge";
import { useHlActivity } from "@/components/trade/use-hyperliquid";
import { Button } from "@/components/ui/button";
import { formatUsd } from "@/lib/hyperliquid/math";
import { formatUsdFromMicros } from "@/lib/money";
import { useSignedInWallet } from "@/lib/use-signed-in-wallet";
import { cn } from "@/lib/utils";
import ActivityLoading, { ActivityListSkeleton } from "./loading";

type Row = {
  id: string;
  time: number;
  icon: typeof ArrowDownLeft;
  title: string;
  detail: string;
  amount: number | null;
  status?: string;
  href?: string;
};

function dayLabel(time: number): string {
  const date = new Date(time);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
}

export default function ActivityPage() {
  const { ready, isSignedIn, address } = useSignedInWallet();
  const requests = useQuery(api.activity.listMine, isSignedIn ? {} : "skip");
  const hl = useHlActivity(isSignedIn ? address : undefined);

  const groups = useMemo(() => {
    const rows: Row[] = [
      ...(requests ?? []).map((request) => ({
        id: request.id,
        time: request.createdAt,
        icon: Link2,
        title: request.description || "Payment request",
        detail: `$${formatUsdFromMicros(request.amountUsdMicros)} link`,
        amount: null,
        status: request.status,
        href: `/requests/${request.publicId}`,
      })),
      ...(hl.data ?? []).map((item) => ({
        id: item.id,
        time: item.time,
        icon:
          item.kind === "trade"
            ? CandlestickChart
            : item.kind === "sent" || item.kind === "withdraw"
              ? ArrowUpRight
              : ArrowDownLeft,
        title: item.title,
        detail: item.detail,
        amount: item.amountUsd,
      })),
    ].sort((a, b) => b.time - a.time);
    const byDay = new Map<string, Row[]>();
    for (const row of rows.slice(0, 100)) {
      const label = dayLabel(row.time);
      byDay.set(label, [...(byDay.get(label) ?? []), row]);
    }
    return [...byDay.entries()];
  }, [requests, hl.data]);

  if (!ready) return <ActivityLoading />;

  if (!isSignedIn) {
    return (
      <div className="pr-app-page">
        <h1 className="pr-display text-2xl">Activity</h1>
        <div className="pr-panel pr-panel--padded flex flex-col items-center gap-3">
          <LoginButton />
          <p className="text-center text-sm text-muted">
            Sign in to see trades, transfers and requests.
          </p>
        </div>
      </div>
    );
  }

  const loading = requests === undefined || hl.isLoading;

  return (
    <div className="pr-app-page">
      <h1 className="pr-display text-2xl">Activity</h1>
      {loading && groups.length === 0 ? <ActivityListSkeleton /> : null}
      {hl.isError ? (
        <p className="text-sm text-muted" role="status">
          Trades and transfers could not be loaded from Hyperliquid. Retrying…
        </p>
      ) : null}
      {!loading && groups.length === 0 ? (
        <div className="pr-panel pr-panel--padded space-y-3">
          <p className="font-medium">No activity yet</p>
          <p className="text-sm text-muted">
            Your trades, transfers and payment links show up here.
          </p>
          <Button asChild>
            <Link href="/trade">Start trading</Link>
          </Button>
        </div>
      ) : null}
      {groups.map(([label, rows]) => (
        <section key={label} className="space-y-1" aria-label={label}>
          <h2 className="pr-section-label">{label}</h2>
          <ul className="pr-list">
            {rows.map((row) => {
              const Icon = row.icon;
              const body = (
                <>
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-foreground/5">
                    <Icon className="size-4" strokeWidth={1.75} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{row.title}</span>
                    <span className="block truncate text-xs text-muted">{row.detail}</span>
                  </span>
                  {row.status ? (
                    <StatusBadge status={row.status} />
                  ) : row.amount !== null ? (
                    <span
                      className={cn(
                        "pr-money text-sm font-semibold",
                        row.amount >= 0 ? "text-success" : "text-foreground",
                      )}
                    >
                      {formatUsd(row.amount, { sign: true })}
                    </span>
                  ) : null}
                </>
              );
              return (
                <li key={row.id}>
                  {row.href ? (
                    <Link href={row.href} className="pr-row">
                      {body}
                    </Link>
                  ) : (
                    <div className="pr-row">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
