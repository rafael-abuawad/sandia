"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { AccountCard } from "@/components/trade/account-card";
import { MarketAvatar } from "@/components/trade/market-avatar";
import { useHlAccount, useMarkets } from "@/components/trade/use-hyperliquid";
import { Skeleton } from "@/components/ui/skeleton";
import {
  filterMarkets,
  marketHref,
  type Market,
  type MarketGroup,
} from "@/lib/hyperliquid/markets";
import { formatMarketPrice, formatPercent, formatUsd } from "@/lib/hyperliquid/math";
import type { PositionView } from "@/lib/hyperliquid/account";
import { useSignedInWallet } from "@/lib/use-signed-in-wallet";
import { cn } from "@/lib/utils";

const TABS: Array<{ value: MarketGroup; label: string }> = [
  { value: "crypto", label: "Crypto" },
  { value: "stocks", label: "Stocks" },
  { value: "macro", label: "Macro" },
];

function isGroup(value: string | null): value is MarketGroup {
  return value === "crypto" || value === "stocks" || value === "macro";
}

export function TradeHome() {
  const params = useSearchParams();
  const router = useRouter();
  const initialTab = params.get("tab");
  const [tab, setTab] = useState<MarketGroup>(isGroup(initialTab) ? initialTab : "crypto");
  const [query, setQuery] = useState("");
  const { data: markets, isLoading, isError } = useMarkets();
  const { address } = useSignedInWallet();
  const { data: account } = useHlAccount(address);

  const visible = useMemo(
    () => (markets ? filterMarkets(markets, tab, query) : []),
    [markets, tab, query],
  );
  const bySymbol = useMemo(() => new Map(markets?.map((m) => [m.coin, m])), [markets]);

  function selectTab(next: MarketGroup) {
    setTab(next);
    router.replace(next === "crypto" ? "/trade" : `/trade?tab=${next}`, { scroll: false });
  }

  return (
    <div className="pr-app-page">
      <AccountCard />

      {account && account.positions.length > 0 ? (
        <section aria-labelledby="positions-heading" className="space-y-2">
          <h2 id="positions-heading" className="pr-section-label">
            Positions
          </h2>
          <ul className="pr-list">
            {account.positions.map((position) => (
              <PositionRow
                key={position.coin}
                position={position}
                market={bySymbol.get(position.coin)}
              />
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="markets-heading" className="space-y-3">
        <h2 id="markets-heading" className="sr-only">
          Markets
        </h2>
        <div className="pr-search">
          <Search className="size-4 shrink-0 text-muted" aria-hidden />
          <input
            type="search"
            inputMode="search"
            placeholder="Search BTC, Tesla, gold…"
            aria-label="Search markets"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted"
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery("")}
              className="-me-3 grid size-11 shrink-0 place-items-center rounded-full text-muted"
            >
              <X className="size-4" aria-hidden />
            </button>
          ) : null}
        </div>

        {!query ? (
          <div role="tablist" aria-label="Market type" className="pr-segmented">
            {TABS.map((item) => (
              <button
                key={item.value}
                type="button"
                role="tab"
                aria-selected={tab === item.value}
                data-active={tab === item.value ? "true" : undefined}
                onClick={() => selectTab(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
        ) : null}

        {isLoading ? <MarketListSkeleton /> : null}
        {isError && !markets ? (
          <p className="pr-panel pr-panel--padded text-sm text-muted" role="alert">
            Markets could not be loaded. Check your connection.
          </p>
        ) : null}
        {markets && visible.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">No markets match “{query}”.</p>
        ) : null}
        {visible.length > 0 ? (
          <ul className="pr-list">
            {visible.map((market) => (
              <MarketRow key={market.coin} market={market} />
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}

function ChangePill({ value }: { value: number }) {
  return (
    <span
      className={cn(
        "pr-money inline-flex min-w-[4.25rem] justify-center rounded-md px-1.5 py-0.5 text-xs font-semibold",
        value >= 0 ? "bg-success-soft text-success" : "bg-danger-soft text-danger",
      )}
    >
      {formatPercent(value)}
    </span>
  );
}

function MarketRow({ market }: { market: Market }) {
  return (
    <li>
      <Link href={marketHref(market.coin)} className="pr-row">
        <MarketAvatar symbol={market.symbol} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{market.symbol}</span>
          <span className="block truncate text-xs text-muted">
            {market.name !== market.symbol ? `${market.name} · ` : ""}
            {market.maxLeverage}x · {formatUsd(market.volume24h, { compact: true })} vol
          </span>
        </span>
        <span className="flex flex-col items-end gap-1">
          <span className="pr-money text-sm font-semibold">
            ${formatMarketPrice(market.markPx)}
          </span>
          <ChangePill value={market.change24h} />
        </span>
      </Link>
    </li>
  );
}

export function PositionRow({
  position,
  market,
}: {
  position: PositionView;
  market: Market | undefined;
}) {
  const symbol = market?.symbol ?? position.coin.replace(/^[a-z0-9]+:/, "");
  return (
    <li>
      <Link href={marketHref(position.coin)} className="pr-row">
        <MarketAvatar symbol={symbol} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-semibold">{symbol}</span>
            <span
              className={cn(
                "pr-side-tag",
                position.side === "long" ? "pr-side-tag--long" : "pr-side-tag--short",
              )}
            >
              {position.side === "long" ? "Long" : "Short"} {position.leverage}x
            </span>
          </span>
          <span className="pr-money block truncate text-xs text-muted">
            {formatUsd(Math.abs(position.positionValue))} · entry $
            {formatMarketPrice(position.entryPx)}
          </span>
        </span>
        <span className="flex flex-col items-end">
          <span
            className={cn(
              "pr-money text-sm font-semibold",
              position.unrealizedPnl >= 0 ? "text-success" : "text-danger",
            )}
          >
            {formatUsd(position.unrealizedPnl, { sign: true })}
          </span>
          <span
            className={cn(
              "pr-money text-xs",
              position.returnOnEquity >= 0 ? "text-success" : "text-danger",
            )}
          >
            {formatPercent(position.returnOnEquity)}
          </span>
        </span>
      </Link>
    </li>
  );
}

export function MarketListSkeleton() {
  return (
    <ul className="pr-list" role="status" aria-label="Loading markets" aria-busy="true">
      {Array.from({ length: 8 }, (_, i) => (
        <li key={i} className="pr-row">
          <Skeleton className="size-10 rounded-full" />
          <span className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-3 w-28" />
          </span>
          <span className="space-y-1.5">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="ms-auto h-4 w-14" />
          </span>
        </li>
      ))}
    </ul>
  );
}
