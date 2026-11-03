"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { MarketAvatar } from "@/components/trade/market-avatar";
import { OrderTicket } from "@/components/trade/order-ticket";
import { PriceChart } from "@/components/trade/price-chart";
import {
  useCandles,
  useHlAccount,
  useMarket,
  useTrader,
  type CandleInterval,
} from "@/components/trade/use-hyperliquid";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Skeleton } from "@/components/ui/skeleton";
import { hlErrorMessage } from "@/lib/hyperliquid/errors";
import type { Market } from "@/lib/hyperliquid/markets";
import { formatMarketPrice, formatPercent, formatUsd, type Side } from "@/lib/hyperliquid/math";
import type { PositionView } from "@/lib/hyperliquid/account";
import { useSignedInWallet } from "@/lib/use-signed-in-wallet";
import { cn } from "@/lib/utils";

const RANGES: Array<{ value: CandleInterval; label: string }> = [
  { value: "1h", label: "1H" },
  { value: "1d", label: "1D" },
  { value: "1w", label: "1W" },
  { value: "1m", label: "1M" },
];

export function MarketScreen({ coin }: { coin: string }) {
  const { market, isLoading } = useMarket(coin);
  const params = useSearchParams();
  const sideParam = params.get("side");
  const [ticket, setTicket] = useState<Side | null>(
    sideParam === "long" || sideParam === "short" ? sideParam : null,
  );
  const [lastSide, setLastSide] = useState<Side>(ticket ?? "long");

  if (isLoading) return <MarketScreenSkeleton />;
  if (!market) {
    return (
      <div className="pr-app-page text-center">
        <p className="pr-display text-xl">Market not found</p>
        <p className="text-sm text-muted">{coin} is not listed right now.</p>
        <Button asChild variant="secondary">
          <Link href="/trade">All markets</Link>
        </Button>
      </div>
    );
  }

  function openTicket(side: Side) {
    setLastSide(side);
    setTicket(side);
  }

  return (
    <div className="pr-app-page pbe-24 md:pbe-0">
      <MarketHeader market={market} />
      <ChartBlock market={market} />
      <PositionBlock market={market} />
      <Stats market={market} />

      <div className="pr-trade-bar">
        <Button type="button" size="lg" className="flex-1" onClick={() => openTicket("long")}>
          Long ↑
        </Button>
        <Button
          type="button"
          size="lg"
          className="pr-btn-short flex-1"
          onClick={() => openTicket("short")}
        >
          Short ↓
        </Button>
      </div>

      <OrderTicket
        market={market}
        side={ticket ?? lastSide}
        open={ticket !== null}
        onOpenChange={(open) => setTicket(open ? lastSide : null)}
        initialAmount={params.get("amount") ?? undefined}
        initialLeverage={Number(params.get("leverage")) || undefined}
      />
    </div>
  );
}

function MarketHeader({ market }: { market: Market }) {
  return (
    <header className="flex items-center gap-3">
      <Button asChild variant="ghost" size="icon" className="-mis-2">
        <Link
          href={market.group === "crypto" ? "/trade" : `/trade?tab=${market.group}`}
          aria-label="Back to markets"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </Link>
      </Button>
      <MarketAvatar symbol={market.symbol} className="size-9" />
      <div className="min-w-0">
        <h1 className="truncate text-lg leading-tight font-semibold">{market.symbol}</h1>
        <p className="truncate text-xs text-muted">
          {market.name !== market.symbol ? `${market.name} · ` : ""}
          {market.group === "crypto" ? "Perpetual" : "Stock perpetual"} · up to {market.maxLeverage}
          x
        </p>
      </div>
    </header>
  );
}

function ChartBlock({ market }: { market: Market }) {
  const [range, setRange] = useState<CandleInterval>("1d");
  const [scrub, setScrub] = useState<{ t: number; c: number } | null>(null);
  const { data, isLoading } = useCandles(market.coin, range);
  const first = data?.[0]?.c;
  const shown = scrub?.c ?? market.markPx;
  const change = first ? shown / first - 1 : range === "1d" ? market.change24h : 0;

  return (
    <section className="space-y-3" aria-label="Price">
      <div>
        <p
          className="pr-money text-[2.25rem] leading-none font-semibold tracking-tight"
          aria-live="polite"
        >
          ${formatMarketPrice(shown)}
        </p>
        <p
          className={cn(
            "pr-money mbs-1 text-sm font-semibold",
            change >= 0 ? "text-success" : "text-danger",
          )}
        >
          {formatPercent(change)}{" "}
          <span className="font-normal text-muted">
            {scrub
              ? new Date(scrub.t).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })
              : RANGES.find((r) => r.value === range)?.label}
          </span>
        </p>
      </div>
      <PriceChart points={data} loading={isLoading} onScrub={setScrub} />
      <div role="tablist" aria-label="Chart range" className="pr-segmented pr-segmented--quiet">
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
  );
}

function PositionBlock({ market }: { market: Market }) {
  const { address } = useSignedInWallet();
  const { data } = useHlAccount(address);
  const position = data?.positions.find((item) => item.coin === market.coin);
  if (!position) return null;
  return <PositionCard market={market} position={position} />;
}

function PositionCard({ market, position }: { market: Market; position: PositionView }) {
  const { address } = useSignedInWallet();
  const { close } = useTrader(address);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();
  const up = position.unrealizedPnl >= 0;

  async function onClose() {
    setClosing(true);
    setError(null);
    try {
      await close({ market, size: position.size });
    } catch (cause) {
      setError(hlErrorMessage(cause, "The position was not closed. Try again."));
    } finally {
      setClosing(false);
    }
  }

  return (
    <section className="pr-panel pr-panel--padded space-y-4" aria-label="Your position">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="pr-kicker">Your position</p>
          <p className="mbs-1 flex items-center gap-2 font-semibold">
            <span
              className={cn(
                "pr-side-tag",
                position.side === "long" ? "pr-side-tag--long" : "pr-side-tag--short",
              )}
            >
              {position.side === "long" ? "Long" : "Short"} {position.leverage}x
            </span>
            <span className="pr-money">{formatUsd(Math.abs(position.positionValue))}</span>
          </p>
        </div>
        <div className="text-end">
          <p className={cn("pr-money text-lg font-semibold", up ? "text-success" : "text-danger")}>
            {formatUsd(position.unrealizedPnl, { sign: true })}
          </p>
          <p className={cn("pr-money text-xs", up ? "text-success" : "text-danger")}>
            {formatPercent(position.returnOnEquity)}
          </p>
        </div>
      </div>
      <dl className="pr-summary">
        <div>
          <dt>Entry</dt>
          <dd>${formatMarketPrice(position.entryPx)}</dd>
        </div>
        <div>
          <dt>Liquidation</dt>
          <dd>{position.liquidationPx ? `$${formatMarketPrice(position.liquidationPx)}` : "—"}</dd>
        </div>
        <div>
          <dt>Size</dt>
          <dd>
            {Math.abs(position.size)} {market.symbol}
          </dd>
        </div>
      </dl>
      <FieldError id={errorId} message={error} />
      <Button
        type="button"
        variant="secondary"
        className="w-full"
        disabled={closing}
        onClick={() => void onClose()}
      >
        {closing ? "Closing…" : "Close position"}
      </Button>
    </section>
  );
}

function Stats({ market }: { market: Market }) {
  const items = [
    { label: "24h volume", value: formatUsd(market.volume24h, { compact: true }) },
    { label: "Open interest", value: formatUsd(market.openInterestUsd, { compact: true }) },
    { label: "Funding / hr", value: `${(market.funding * 100).toFixed(4)}%` },
    { label: "Max leverage", value: `${market.maxLeverage}x` },
  ];
  return (
    <section aria-label="Market stats">
      <dl className="grid grid-cols-2 gap-2">
        {items.map((item) => (
          <div key={item.label} className="pr-stat">
            <dt>{item.label}</dt>
            <dd className="pr-money">{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function MarketScreenSkeleton() {
  return (
    <div className="pr-app-page" role="status" aria-label="Loading market" aria-busy="true">
      <div className="flex items-center gap-3">
        <Skeleton className="size-9 rounded-full" />
        <Skeleton className="h-5 w-24" />
      </div>
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
