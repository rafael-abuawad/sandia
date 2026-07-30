"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Search } from "lucide-react";
import type { StockQuote, StockToken } from "@/lib/rhj/client";
import { formatSpreadPct, formatUsdPrice, formatVolume } from "@/lib/rhj/format";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type MarketRow = StockToken & {
  quote: StockQuote | null;
};

type SortKey = "symbol" | "price" | "spread" | "volume";
type SortDir = "asc" | "desc";

export function StocksMarket() {
  const [assets, setAssets] = useState<StockToken[]>([]);
  const [quotesBySymbol, setQuotesBySymbol] = useState<Record<string, StockQuote>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("volume");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const load = useCallback(async () => {
    setError(null);
    try {
      const [assetsRes, pricesRes] = await Promise.all([
        fetch("/api/rhj/assets"),
        fetch("/api/rhj/prices"),
      ]);
      if (!assetsRes.ok) {
        const body = (await assetsRes.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Failed to load stock tokens");
      }
      if (!pricesRes.ok) {
        const body = (await pricesRes.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Failed to load prices");
      }

      const assetsJson = (await assetsRes.json()) as { assets: StockToken[] };
      const pricesJson = (await pricesRes.json()) as { quotes: StockQuote[] };

      setAssets(assetsJson.assets ?? []);
      const map: Record<string, StockQuote> = {};
      for (const q of pricesJson.quotes ?? []) {
        map[q.symbol.toUpperCase()] = q;
      }
      setQuotesBySymbol(map);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load markets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(id);
  }, [load]);

  const rows: MarketRow[] = useMemo(() => {
    return assets.map((asset) => ({
      ...asset,
      quote: quotesBySymbol[asset.symbol.toUpperCase()] ?? null,
    }));
  }, [assets, quotesBySymbol]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = rows;
    if (q) {
      list = list.filter(
        (row) =>
          row.symbol.toLowerCase().includes(q) ||
          row.shortName.toLowerCase().includes(q) ||
          row.name.toLowerCase().includes(q),
      );
    }

    const dir = sortDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
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
        case "spread": {
          const sa = qa?.spreadPct ?? -1;
          const sb = qb?.spreadPct ?? -1;
          return (sa - sb) * dir;
        }
        case "volume":
        default: {
          const va = qa?.dailyTradingVolume ?? -1;
          const vb = qb?.dailyTradingVolume ?? -1;
          return (va - vb) * dir;
        }
      }
    });
  }, [rows, query, sortKey, sortDir]);

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
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          Tokenized equities on Robinhood Chain. Prices track the underlying stock — these are not
          the shares themselves.
        </p>
      </div>

      <div className="relative max-w-md">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle"
          aria-hidden
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search symbol or name"
          className="pl-9"
          aria-label="Search stock tokens"
        />
      </div>

      <p className="text-xs text-subtle">
        Live quotes from Robinhood Stock Token APIs. Stats may lag; volume is underlying daily
        trading volume.
      </p>

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="pr-panel overflow-hidden">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 border-b border-border bg-[var(--panel-elevated)]">
              <tr className="text-[11px] font-bold uppercase tracking-[0.14em] text-subtle">
                <SortHeader
                  label="Token"
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
                  label="Spread"
                  active={sortKey === "spread"}
                  dir={sortDir}
                  onClick={() => toggleSort("spread")}
                  align="right"
                />
                <SortHeader
                  label="1D Volume"
                  active={sortKey === "volume"}
                  dir={sortDir}
                  onClick={() => toggleSort("volume")}
                  align="right"
                />
                <th className="px-4 py-3 font-bold">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted">
                    Loading markets…
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted">
                    {query.trim() ? (
                      <span className="inline-flex flex-col items-center gap-2">
                        <span>No results for &lsquo;{query.trim()}&rsquo;.</span>
                        <button
                          type="button"
                          className="font-semibold text-foreground underline underline-offset-2"
                          onClick={() => setQuery("")}
                        >
                          Clear search
                        </button>
                      </span>
                    ) : (
                      "No stock tokens available."
                    )}
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
          {loading && (
            <li className="px-4 py-10 text-center text-sm text-muted">Loading markets…</li>
          )}
          {!loading && filtered.length === 0 && (
            <li className="px-4 py-10 text-center text-sm text-muted">
              {query.trim() ? (
                <span className="inline-flex flex-col items-center gap-2">
                  <span>No results for &lsquo;{query.trim()}&rsquo;.</span>
                  <button
                    type="button"
                    className="font-semibold text-foreground underline underline-offset-2"
                    onClick={() => setQuery("")}
                  >
                    Clear search
                  </button>
                </span>
              ) : (
                "No stock tokens available."
              )}
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
  return (
    <th className={cn("px-4 py-3", align === "right" && "text-right")}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1 transition-colors hover:text-foreground",
          active ? "text-foreground" : "text-subtle",
          align === "right" && "flex-row-reverse",
        )}
      >
        {label}
        {active ? (
          dir === "asc" ? (
            <ArrowUp className="size-3" aria-hidden />
          ) : (
            <ArrowDown className="size-3" aria-hidden />
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
      <div className="min-w-0">
        <p className="truncate font-semibold text-foreground">{row.shortName}</p>
        <p className="pr-mono text-xs text-subtle">{row.symbol}</p>
      </div>
    </div>
  );
}

function TokenLogo({ src, symbol }: { src: string | null; symbol: string }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-panel text-[10px] font-bold uppercase text-muted ring-1 ring-border">
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
  return (
    <tr
      className={cn(
        "border-b border-border last:border-b-0 transition-colors hover:bg-foreground/[0.03]",
        halted && "opacity-60",
      )}
    >
      <td className="px-4 py-3">
        <Link href={`/stocks/${encodeURIComponent(row.symbol)}`} className="block">
          <TokenCell row={row} />
        </Link>
      </td>
      <td className="px-4 py-3 text-right">
        <Link
          href={`/stocks/${encodeURIComponent(row.symbol)}`}
          className="block pr-mono font-semibold text-foreground"
          aria-label={`${row.symbol} price ${formatUsdPrice(row.quote?.mid)}`}
        >
          {formatUsdPrice(row.quote?.mid)}
        </Link>
      </td>
      <td className="px-4 py-3 text-right">
        <span className="pr-mono text-muted">{formatSpreadPct(row.quote?.spreadPct)}</span>
      </td>
      <td className="px-4 py-3 text-right">
        <span className="pr-mono text-foreground">
          {formatVolume(row.quote?.dailyTradingVolume)}
        </span>
      </td>
      <td className="px-4 py-3">
        {halted ? (
          <span className="rounded-md bg-[var(--danger-soft)] px-2 py-0.5 text-xs font-semibold text-danger">
            Halted
          </span>
        ) : (
          <span className="rounded-md bg-[var(--success-soft)] px-2 py-0.5 text-xs font-semibold text-success">
            Open
          </span>
        )}
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
          <p className="pr-mono text-xs text-muted">
            Vol {formatVolume(row.quote?.dailyTradingVolume)}
          </p>
        </div>
      </Link>
    </li>
  );
}
