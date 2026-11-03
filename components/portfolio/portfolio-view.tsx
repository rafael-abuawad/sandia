"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, CandlestickChart } from "lucide-react";
import { LoginButton } from "@/components/login-button";
import { PriceChart } from "@/components/trade/price-chart";
import { PositionRow } from "@/components/trade/trade-home";
import {
  useHlAccount,
  useHlActivity,
  useMarkets,
  usePortfolioHistory,
} from "@/components/trade/use-hyperliquid";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPercent, formatUsd } from "@/lib/hyperliquid/math";
import { allocation, rangePnl, type PortfolioRange } from "@/lib/hyperliquid/portfolio";
import { useSignedInWallet } from "@/lib/use-signed-in-wallet";
import { cn } from "@/lib/utils";

const RANGES: Array<{ value: PortfolioRange; label: string; caption: string }> = [
  { value: "day", label: "1D", caption: "today" },
  { value: "week", label: "1W", caption: "this week" },
  { value: "month", label: "1M", caption: "this month" },
  { value: "allTime", label: "All", caption: "all time" },
];

const MAX_SLICES = 6;

export function PortfolioView() {
  const { ready, isSignedIn, address } = useSignedInWallet();

  if (!ready) return <PortfolioSkeleton />;
  if (!isSignedIn || !address) {
    return (
      <div className="pr-app-page">
        <h1 className="pr-display text-2xl">Portfolio</h1>
        <div className="pr-panel pr-panel--padded flex flex-col items-center gap-3">
          <LoginButton />
          <p className="text-center text-sm text-muted">
            Sign in to see your balance and positions.
          </p>
        </div>
      </div>
    );
  }
  return <SignedInPortfolio address={address} />;
}

function SignedInPortfolio({ address }: { address: string }) {
  const account = useHlAccount(address);
  const history = usePortfolioHistory(address);
  const activity = useHlActivity(address);
  const { data: markets } = useMarkets();
  const [range, setRange] = useState<PortfolioRange>("day");
  const [scrub, setScrub] = useState<{ t: number; c: number } | null>(null);

  const bySymbol = useMemo(() => new Map(markets?.map((m) => [m.coin, m])), [markets]);
  const series = history.data?.[range];
  const pnl = series ? rangePnl(series.pnl) : 0;
  const start = series?.value[0]?.c ?? 0;
  const pnlPct = start > 0 ? pnl / start : 0;
  const caption = RANGES.find((r) => r.value === range)?.caption ?? "";

  if (account.isLoading) return <PortfolioSkeleton />;
  const data = account.data;
  const equity = scrub?.c ?? data?.equity ?? 0;
  const marginInUse = data ? data.positions.reduce((sum, p) => sum + p.marginUsed, 0) : 0;

  return (
    <div className="pr-app-page">
      <header className="space-y-1">
        <p className="pr-kicker">Portfolio</p>
        {account.isError && !data ? (
          <p className="text-sm text-muted">Balance unavailable. Retrying…</p>
        ) : (
          <>
            <p
              className="pr-money text-[2.5rem] leading-none font-semibold tracking-tight"
              aria-live="polite"
            >
              {formatUsd(equity)}
            </p>
            <p
              className={cn(
                "pr-money text-sm font-semibold",
                pnl >= 0 ? "text-success" : "text-danger",
              )}
            >
              {scrub ? (
                <span className="font-normal text-muted">
                  {new Date(scrub.t).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              ) : (
                <>
                  {formatUsd(pnl, { sign: true })} ({formatPercent(pnlPct)}){" "}
                  <span className="font-normal text-muted">{caption}</span>
                </>
              )}
            </p>
          </>
        )}
      </header>

      <section className="space-y-3" aria-label="Account value over time">
        {series && series.value.length >= 2 ? (
          <PriceChart points={series.value} onScrub={setScrub} />
        ) : (
          <PriceChart points={undefined} loading={history.isLoading} />
        )}
        <div role="tablist" aria-label="Time range" className="pr-segmented pr-segmented--quiet">
          {RANGES.map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={range === item.value}
              data-active={range === item.value ? "true" : undefined}
              onClick={() => setRange(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-3 gap-2">
        <Button asChild variant="secondary" size="lg" className="flex-col gap-1 h-auto py-3">
          <Link href="/requests/new">
            <ArrowDownLeft className="size-4" aria-hidden /> Add funds
          </Link>
        </Button>
        <Button asChild variant="secondary" size="lg" className="flex-col gap-1 h-auto py-3">
          <Link href="/send">
            <ArrowUpRight className="size-4" aria-hidden /> Send
          </Link>
        </Button>
        <Button asChild variant="secondary" size="lg" className="flex-col gap-1 h-auto py-3">
          <Link href="/trade">
            <CandlestickChart className="size-4" aria-hidden /> Trade
          </Link>
        </Button>
      </div>

      {data ? (
        <section aria-label="Balance breakdown">
          <dl className="grid grid-cols-2 gap-2">
            <Stat label="Available" value={formatUsd(data.available)} />
            <Stat label="In positions" value={formatUsd(marginInUse)} />
            <Stat
              label="Open PnL"
              value={formatUsd(data.unrealizedPnl, { sign: true })}
              tone={data.positions.length ? (data.unrealizedPnl >= 0 ? "up" : "down") : undefined}
            />
            <Stat
              label={`Volume ${RANGES.find((r) => r.value === range)?.label ?? ""}`}
              value={formatUsd(series?.volume ?? 0, { compact: true })}
            />
          </dl>
        </section>
      ) : null}

      {data ? <Allocation available={data.available} positions={data.positions} /> : null}

      <section aria-labelledby="portfolio-positions" className="space-y-2">
        <h2 id="portfolio-positions" className="pr-section-label">
          Positions
        </h2>
        {data && data.positions.length > 0 ? (
          <ul className="pr-list">
            {data.positions.map((position) => (
              <PositionRow
                key={position.coin}
                position={position}
                market={bySymbol.get(position.coin)}
              />
            ))}
          </ul>
        ) : (
          <div className="pr-panel pr-panel--padded flex items-center justify-between gap-3">
            <p className="text-sm text-muted">No open positions.</p>
            <Button asChild size="sm">
              <Link href="/trade">Find a market</Link>
            </Button>
          </div>
        )}
      </section>

      <section aria-labelledby="portfolio-activity" className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 id="portfolio-activity" className="pr-section-label">
            Recent activity
          </h2>
          <Link href="/activity" className="text-sm font-semibold underline underline-offset-2">
            See all
          </Link>
        </div>
        {activity.data && activity.data.length > 0 ? (
          <ul className="pr-list">
            {activity.data.slice(0, 5).map((item) => (
              <li key={item.id} className="pr-row">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{item.title}</span>
                  <span className="block truncate text-xs text-muted">{item.detail}</span>
                </span>
                {item.amountUsd !== null ? (
                  <span
                    className={cn(
                      "pr-money text-sm font-semibold",
                      item.amountUsd >= 0 ? "text-success" : "text-foreground",
                    )}
                  >
                    {formatUsd(item.amountUsd, { sign: true })}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">
            {activity.isLoading ? "Loading…" : "Trades and transfers show up here."}
          </p>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  return (
    <div className="pr-stat">
      <dt>{label}</dt>
      <dd
        className={cn(
          "pr-money",
          tone === "up" && "text-success",
          tone === "down" && "text-danger",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/**
 * Cash plus each position's equity. Hues follow the coin (alphabetical among open positions),
 * never its size, so a growing position keeps its color. Past six positions the rest fold into
 * "Other". The legend always lists names and values, so color never carries identity alone.
 */
function Allocation({
  available,
  positions,
}: {
  available: number;
  positions: Parameters<typeof allocation>[1];
}) {
  const slices = useMemo(() => {
    const raw = allocation(available, positions);
    const cash = raw.find((slice) => slice.label === "Cash");
    const held = raw.filter((slice) => slice.label !== "Cash");
    const kept = held.slice(0, MAX_SLICES);
    const rest = held.slice(MAX_SLICES);
    const slots = new Map(
      [...kept]
        .sort((a, b) => a.label.localeCompare(b.label))
        .map((slice, index) => [slice.label, `var(--alloc-${index + 1})`]),
    );
    const other = rest.length
      ? [
          {
            label: "Other",
            value: rest.reduce((sum, s) => sum + s.value, 0),
            share: rest.reduce((sum, s) => sum + s.share, 0),
            color: "var(--alloc-neutral)",
            faded: true,
          },
        ]
      : [];
    return [
      ...kept.map((slice) => ({ ...slice, color: slots.get(slice.label)!, faded: false })),
      ...other,
      ...(cash ? [{ ...cash, color: "var(--alloc-neutral)", faded: false }] : []),
    ];
  }, [available, positions]);

  if (slices.length === 0) return null;

  return (
    <section aria-labelledby="portfolio-allocation" className="space-y-3">
      <h2 id="portfolio-allocation" className="pr-section-label">
        Allocation
      </h2>
      <div className="pr-alloc-bar" aria-hidden>
        {slices.map((slice) => (
          <span
            key={slice.label}
            title={`${slice.label} · ${formatUsd(slice.value)} · ${(slice.share * 100).toFixed(1)}%`}
            style={{
              flexGrow: slice.share,
              flexBasis: 0,
              backgroundColor: slice.color,
              opacity: slice.faded ? 0.55 : 1,
            }}
          />
        ))}
      </div>
      <table className="w-full text-sm">
        <caption className="sr-only">Allocation by holding</caption>
        <tbody>
          {slices.map((slice) => (
            <tr key={slice.label} className="border-be border-border last:border-0">
              <th scope="row" className="py-2 text-start font-medium">
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: slice.color, opacity: slice.faded ? 0.55 : 1 }}
                  />
                  {slice.label}
                </span>
              </th>
              <td className="pr-money py-2 text-end">{formatUsd(slice.value)}</td>
              <td className="pr-money w-16 py-2 text-end text-muted">
                {(slice.share * 100).toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function PortfolioSkeleton() {
  return (
    <div className="pr-app-page" role="status" aria-label="Loading portfolio" aria-busy="true">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-44 w-full rounded-[var(--radius-lg)]" />
      <div className="grid grid-cols-2 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 rounded-[var(--radius)]" />
        ))}
      </div>
    </div>
  );
}
