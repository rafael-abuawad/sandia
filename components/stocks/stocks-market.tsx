"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { StockQuote, StockToken } from "@/lib/rhj/client";
import { formatUsdPrice, formatVolume } from "@/lib/rhj/format";
import { LISTED_CHAIN_STOCKS } from "@/lib/stocks/assets";
import { Badge } from "@/components/ui/badge";
import { useChainTokenStats } from "@/components/stocks/use-chain-stats";
import { useUniswapDisplayPrices } from "@/components/stocks/use-uniswap-price";
import {
  StockListDesktopSkeletonRows,
  StockListMobileSkeletonItems,
} from "@/components/stocks/stock-skeletons";
import { cn } from "@/lib/utils";
import { userFacingError } from "@/lib/user-facing-error";

const FEATURED_SYMBOLS = ["SPY", "NVDA", "SPCX", "GLD", "META", "GOOGL", "AAPL", "QQQ"] as const;

type MarketRow = StockToken & {
  quote: StockQuote | null;
};

type SortKey = "symbol" | "price" | "volume";
type SortDir = "asc" | "desc";

export function StocksMarket() {
  const [assets, setAssets] = useState<StockToken[]>([]);
  const [quotesBySymbol, setQuotesBySymbol] = useState<Record<string, StockQuote>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const listedPrices = useUniswapDisplayPrices(LISTED_CHAIN_STOCKS);
  const chainStats = useChainTokenStats(true);

  const applyQuotes = useCallback((quotes: StockQuote[]) => {
    const map: Record<string, StockQuote> = {};
    for (const quote of quotes) {
      map[quote.symbol.toUpperCase()] = quote;
    }
    setQuotesBySymbol(map);
  }, []);

  const loadAssets = useCallback(async () => {
    const assetsRes = await fetch("/api/rhj/assets");
    if (!assetsRes.ok) {
      const body = (await assetsRes.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? "Failed to load stock tokens");
    }
    const assetsJson = (await assetsRes.json()) as { assets: StockToken[] };
    setAssets(assetsJson.assets ?? []);
  }, []);

  const loadPrices = useCallback(async () => {
    const pricesRes = await fetch("/api/rhj/prices");
    if (!pricesRes.ok) {
      const body = (await pricesRes.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? "Failed to load prices");
    }
    const pricesJson = (await pricesRes.json()) as { quotes: StockQuote[] };
    applyQuotes(pricesJson.quotes ?? []);
  }, [applyQuotes]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setError(null);
      try {
        await Promise.all([loadAssets(), loadPrices()]);
      } catch (err) {
        if (!cancelled) setError(userFacingError(err, "Stock prices could not be loaded."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    const id = window.setInterval(() => {
      void loadPrices().catch((err) => {
        setError(userFacingError(err, "Stock prices could not be loaded."));
      });
    }, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [loadAssets, loadPrices]);

  const featuredRows: MarketRow[] = useMemo(() => {
    const listed = new Set(LISTED_CHAIN_STOCKS.map((asset) => asset.symbol));
    const bySymbol = new Map(assets.map((asset) => [asset.symbol.toUpperCase(), asset]));
    return FEATURED_SYMBOLS.flatMap((symbol) => {
      if (listed.has(symbol)) return [];
      const asset = bySymbol.get(symbol);
      if (!asset) return [];
      return [{ ...asset, quote: quotesBySymbol[symbol] ?? null }];
    });
  }, [assets, quotesBySymbol]);

  const listedRows: MarketRow[] = useMemo(
    () =>
      LISTED_CHAIN_STOCKS.map((asset) => {
        const stat = chainStats[asset.symbol];
        return {
          ...asset,
          quote: {
            symbol: asset.symbol,
            bid: null,
            ask: null,
            mid: listedPrices[asset.symbol] ?? stat?.priceUsd ?? null,
            spreadPct: null,
            currency: "USD",
            dailyTradingVolume: stat?.volumeUsd24h ?? null,
            isTradingHalt: false,
            generatedAt: null,
            dailyHigh: null,
            dailyLow: null,
            contractAddress: asset.contractAddress,
          },
        };
      }),
    [chainStats, listedPrices],
  );

  const filtered = useMemo(() => {
    if (loading) return [];
    const rows = [...listedRows, ...featuredRows];
    if (!sortKey) return rows;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const qa = a.quote;
      const qb = b.quote;
      switch (sortKey) {
        case "symbol":
          return a.symbol.localeCompare(b.symbol) * dir;
        case "price": {
          const pa = qa?.mid ?? -1;
          const pb = qb?.mid ?? -1;
          return (pa - pb) * dir;
        }
        case "volume":
        default: {
          const va = qa?.dailyTradingVolume ?? -1;
          const vb = qb?.dailyTradingVolume ?? -1;
          return (va - vb) * dir;
        }
      }
    });
  }, [featuredRows, listedRows, loading, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "symbol" ? "asc" : "desc");
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h1 className="pr-display text-2xl sm:text-3xl">Stocks</h1>
        <p className="text-sm leading-relaxed text-muted">Prices for a short list of stocks.</p>
      </div>

      <p className="text-xs text-muted">Prices can lag the stock market by a few seconds.</p>

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="pr-panel overflow-hidden">
        <div className="hidden md:block">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 border-b border-border bg-[var(--panel-elevated)]">
              <tr className="pr-kicker">
                <SortHeader
                  label="Stock"
                  active={sortKey === "symbol"}
                  dir={sortDir}
                  onClick={() => toggleSort("symbol")}
                />
                <SortHeader
                  label="Price"
                  active={sortKey === "price"}
                  dir={sortDir}
                  onClick={() => toggleSort("price")}
                  align="right"
                />
                <SortHeader
                  label="Volume"
                  active={sortKey === "volume"}
                  dir={sortDir}
                  onClick={() => toggleSort("volume")}
                  align="right"
                />
                <th className="px-4 py-3 font-bold">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading && filtered.length === 0 ? <StockListDesktopSkeletonRows /> : null}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-sm text-muted">
                    No stock tokens available.
                  </td>
                </tr>
              )}
              {filtered.map((row) => (
                <DesktopRow key={row.id} row={row} />
              ))}
            </tbody>
          </table>
        </div>

        <ul className="divide-y divide-border md:hidden">
          {loading && filtered.length === 0 ? <StockListMobileSkeletonItems /> : null}
          {!loading && filtered.length === 0 && (
            <li className="px-4 py-10 text-center text-sm text-muted">
              No stock tokens available.
            </li>
          )}
          {filtered.map((row) => (
            <MobileRow key={row.id} row={row} />
          ))}
        </ul>
      </div>
    </div>
  );
}

function SortHeader({
  label,
  active,
  dir,
  onClick,
  align = "left",
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  align?: "left" | "right";
}) {
  const sortState = active ? (dir === "asc" ? "ascending" : "descending") : undefined;
  return (
    <th className={cn("px-4 py-3", align === "right" && "text-right")} aria-sort={sortState}>
      <button
        type="button"
        onClick={onClick}
        aria-label={`${label}, ${
          active ? (dir === "asc" ? "sorted ascending" : "sorted descending") : "not sorted"
        }`}
        className={cn(
          "inline-flex shrink-0 items-center gap-1 whitespace-nowrap transition-[color] duration-[var(--duration)] ease-[var(--ease-out)] hover:text-foreground",
          active ? "text-foreground" : "text-muted",
          align === "right" && "flex-row-reverse",
        )}
      >
        {label}
        {active ? (
          dir === "asc" ? (
            <ArrowUp className="size-3" strokeWidth={1.5} aria-hidden />
          ) : (
            <ArrowDown className="size-3" strokeWidth={1.5} aria-hidden />
          )
        ) : null}
      </button>
    </th>
  );
}

function TokenCell({ row }: { row: MarketRow }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <TokenLogo src={row.logoUrl} symbol={row.symbol} />
      <abbr
        title={row.shortName}
        className="pr-mono cursor-help font-semibold text-foreground underline decoration-dotted decoration-muted/70 underline-offset-4"
      >
        {row.symbol}
      </abbr>
    </div>
  );
}

function TokenLogo({ src, symbol }: { src: string | null; symbol: string }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-panel text-xs font-bold uppercase text-muted ring-1 ring-border">
        {symbol.slice(0, 2)}
      </span>
    );
  }
  return (
    <Image
      src={src}
      alt=""
      width={36}
      height={36}
      className="size-9 shrink-0 rounded-full ring-1 ring-border"
      unoptimized
      onError={() => setBroken(true)}
    />
  );
}

function DesktopRow({ row }: { row: MarketRow }) {
  const halted = row.quote?.isTradingHalt;
  const href = `/stocks/${encodeURIComponent(row.symbol)}`;
  return (
    <tr
      className={cn(
        "relative border-b border-border last:border-b-0 transition-[background-color] duration-[var(--duration)] ease-[var(--ease-out)] hover:bg-foreground/[0.03]",
        halted && "opacity-60",
      )}
    >
      <td className="px-4 py-3">
        <Link
          href={href}
          className="after:absolute after:inset-0"
          aria-label={`${row.symbol}, ${row.shortName}`}
        >
          <TokenCell row={row} />
        </Link>
      </td>
      <td className="px-4 py-3 text-right">
        <span className="pr-mono font-semibold text-foreground">
          {formatUsdPrice(row.quote?.mid)}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <span className="pr-mono text-foreground">
          {formatVolume(row.quote?.dailyTradingVolume)}
        </span>
      </td>
      <td className="relative z-10 px-4 py-3">
        {halted ? <Badge variant="danger">Paused</Badge> : <Badge variant="success">Open</Badge>}
      </td>
    </tr>
  );
}

function MobileRow({ row }: { row: MarketRow }) {
  const halted = row.quote?.isTradingHalt;
  return (
    <li>
      <Link
        href={`/stocks/${encodeURIComponent(row.symbol)}`}
        className={cn(
          "flex min-h-14 items-center justify-between gap-3 px-4 py-3",
          halted && "opacity-60",
        )}
      >
        <TokenCell row={row} />
        <div className="shrink-0 text-right">
          <p className="pr-mono font-semibold text-foreground">{formatUsdPrice(row.quote?.mid)}</p>
        </div>
      </Link>
    </li>
  );
}
