"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePaginatedQuery } from "convex/react";
import { ArrowDownLeft, ArrowUpRight, CandlestickChart, Link2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { LoginButton } from "@/components/login-button";
import { StatusBadge } from "@/components/status-badge";
import { usePagedHlActivity } from "@/components/trade/use-hyperliquid";
import { Button } from "@/components/ui/button";
import {
  ACTIVITY_PAGE_SIZE,
  mergeActivityItems,
  sourcesToLoad,
  visibleActivity,
} from "@/lib/hyperliquid/activity";
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

function oldestTime(items: Array<{ time: number }>): number | null {
  if (items.length === 0) return null;
  return items.reduce((min, item) => Math.min(min, item.time), Infinity);
}

export default function ActivityPage() {
  const { ready, isSignedIn, address } = useSignedInWallet();
  const {
    results: requests,
    status,
    loadMore,
  } = usePaginatedQuery(api.activity.listMine, isSignedIn ? {} : "skip", {
    initialNumItems: ACTIVITY_PAGE_SIZE,
  });
  const hl = usePagedHlActivity(isSignedIn ? address : undefined);
  const [shownFor, setShownFor] = useState(address);
  const [shown, setShown] = useState(ACTIVITY_PAGE_SIZE);
  if (address !== shownFor) {
    setShownFor(address);
    setShown(ACTIVITY_PAGE_SIZE);
  }

  const hlItems = useMemo(
    () => mergeActivityItems(hl.data?.pages.map((page) => page.items) ?? []),
    [hl.data],
  );

  const requestRows = useMemo<Row[]>(
    () =>
      requests.map((request) => ({
        id: request.id,
        time: request.createdAt,
        icon: Link2,
        title: request.description || "Payment request",
        detail: `$${formatUsdFromMicros(request.amountUsdMicros)} link`,
        amount: null,
        status: request.status,
        href: `/requests/${request.publicId}`,
      })),
    [requests],
  );

  const tradeRows = useMemo<Row[]>(
    () =>
      hlItems.map((item) => ({
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
    [hlItems],
  );

  const requestsHaveMore = status === "CanLoadMore" || status === "LoadingMore";
  const tradesHaveMore = hl.isPending || hl.hasNextPage || hl.isFetchingNextPage;
  const visible = useMemo(
    () =>
      visibleActivity([
        { items: requestRows, hasMore: status !== "Exhausted" },
        { items: tradeRows, hasMore: tradesHaveMore },
      ]),
    [requestRows, status, tradeRows, tradesHaveMore],
  );
  const rows = visible.slice(0, shown);
  const loadPlan = sourcesToLoad([
    { oldest: oldestTime(requestRows), hasMore: requestsHaveMore },
    { oldest: oldestTime(tradeRows), hasMore: hl.hasNextPage },
  ]);
  const moreBuffered = visible.length > shown;
  const moreToFetch = loadPlan.some(Boolean);
  const loadingMore = (status === "LoadingMore" || hl.isFetchingNextPage) && !moreBuffered;

  const groups = useMemo(() => {
    const byDay = new Map<string, Row[]>();
    for (const row of rows) {
      const label = dayLabel(row.time);
      byDay.set(label, [...(byDay.get(label) ?? []), row]);
    }
    return [...byDay.entries()];
  }, [rows]);

  function onLoadMore() {
    if (visible.length > shown) {
      setShown((count) => count + ACTIVITY_PAGE_SIZE);
      return;
    }
    if (loadPlan[0]) loadMore(ACTIVITY_PAGE_SIZE);
    if (loadPlan[1]) void hl.fetchNextPage();
  }

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

  const loading = status === "LoadingFirstPage" || (Boolean(address) && hl.isPending);
  const showEmpty = !loading && !hl.isError && rows.length === 0 && !moreBuffered && !moreToFetch;

  return (
    <div className="pr-app-page">
      <h1 className="pr-display text-2xl">Activity</h1>
      {loading && groups.length === 0 ? <ActivityListSkeleton /> : null}
      {hl.isError ? (
        <p className="text-sm text-muted" role="status">
          Trades and transfers could not be loaded from Hyperliquid.
        </p>
      ) : null}
      {showEmpty ? (
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
      {groups.map(([label, dayRows]) => (
        <section key={label} className="space-y-1" aria-label={label}>
          <h2 className="pr-section-label">{label}</h2>
          <ul className="pr-list">
            {dayRows.map((row) => {
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
      {moreBuffered || moreToFetch ? (
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          disabled={loadingMore}
          onClick={onLoadMore}
        >
          {loadingMore ? "Loading…" : "Load more"}
        </Button>
      ) : null}
    </div>
  );
}
