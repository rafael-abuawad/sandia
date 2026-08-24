"use client";

import Image from "next/image";
import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import type { StockQuote, StockToken } from "@/lib/rhj/client";
import { explorerTokenUrl } from "@/lib/rhj/client";
import { formatSpreadPct, formatUsdPrice, formatVolume } from "@/lib/rhj/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { shortenAddress } from "@/lib/utils";

export function StockDetail({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol: rawSymbol } = use(params);
  const symbol = decodeURIComponent(rawSymbol).toUpperCase();

  const [asset, setAsset] = useState<StockToken | null>(null);
  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logoBroken, setLogoBroken] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [assetsRes, quoteRes] = await Promise.all([
        fetch("/api/rhj/assets"),
        fetch(`/api/rhj/prices?symbol=${encodeURIComponent(symbol)}`),
      ]);

      if (!assetsRes.ok) {
        throw new Error("Failed to load stock tokens");
      }
      const assetsJson = (await assetsRes.json()) as { assets: StockToken[] };
      const found = assetsJson.assets.find((a) => a.symbol.toUpperCase() === symbol) ?? null;
      if (!found) {
        setAsset(null);
        setQuote(null);
        setError("Stock token not found on Robinhood Chain.");
        return;
      }
      setAsset(found);

      if (quoteRes.ok) {
        const quoteJson = (await quoteRes.json()) as { quote: StockQuote };
        setQuote(quoteJson.quote);
      } else {
        setQuote(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load token");
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(id);
  }, [load]);

  if (loading) {
    return <p className="text-sm text-muted">Loading {symbol}…</p>;
  }

  if (error && !asset) {
    return (
      <div className="pr-page">
        <Link
          href="/stocks"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
        >
          <ArrowLeft className="size-4" strokeWidth={1.5} aria-hidden />
          Back to stocks
        </Link>
        <p className="text-sm text-danger">{error}</p>
      </div>
    );
  }

  if (!asset) return null;

  const explorerUrl = explorerTokenUrl(asset.contractAddress);

  return (
    <div className="pr-page">
      <Link
        href="/stocks"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="size-4" strokeWidth={1.5} aria-hidden />
        Back to stocks
      </Link>

      <div className="flex items-start gap-3">
        {asset.logoUrl && !logoBroken ? (
          <Image
            src={asset.logoUrl}
            alt=""
            width={48}
            height={48}
            className="size-12 shrink-0 rounded-full ring-1 ring-border"
            unoptimized
            onError={() => setLogoBroken(true)}
          />
        ) : (
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-panel text-xs font-bold uppercase text-muted ring-1 ring-border">
            {asset.symbol.slice(0, 2)}
          </span>
        )}
        <div className="min-w-0 space-y-1">
          <h1 className="pr-display pr-mono text-2xl">{asset.symbol}</h1>
          <p className="text-sm text-muted">{asset.shortName}</p>
        </div>
        {quote?.isTradingHalt ? (
          <Badge variant="danger" className="ml-auto">
            Halted
          </Badge>
        ) : (
          <Badge variant="success" className="ml-auto">
            Open
          </Badge>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-4 border-y border-border py-4 sm:grid-cols-4">
        <div className="space-y-1">
          <dt className="pr-kicker">Mid</dt>
          <dd className="pr-mono text-lg font-semibold text-foreground">
            {formatUsdPrice(quote?.mid)}
          </dd>
        </div>
        <div className="space-y-1">
          <dt className="pr-kicker">Bid / Ask</dt>
          <dd className="pr-mono text-sm font-semibold text-foreground">
            {formatUsdPrice(quote?.bid)} / {formatUsdPrice(quote?.ask)}
          </dd>
        </div>
        <div className="space-y-1">
          <dt className="pr-kicker">Spread</dt>
          <dd className="pr-mono whitespace-nowrap text-sm font-semibold text-foreground">
            {formatSpreadPct(quote?.spreadPct)}
          </dd>
        </div>
        <div className="space-y-1">
          <dt className="pr-kicker">1D Volume</dt>
          <dd className="pr-mono text-sm font-semibold text-foreground">
            {formatVolume(quote?.dailyTradingVolume)}
          </dd>
        </div>
      </dl>

      {(quote?.dailyHigh != null || quote?.dailyLow != null) && (
        <p className="pr-mono text-xs text-muted">
          Day range {formatUsdPrice(quote.dailyLow)} – {formatUsdPrice(quote.dailyHigh)}
        </p>
      )}

      <div className="space-y-2">
        <p className="pr-kicker">Contract</p>
        <p className="pr-mono break-all text-sm text-foreground">{asset.contractAddress}</p>
        <a
          href={explorerUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline-offset-2 hover:underline"
        >
          View on explorer ({shortenAddress(asset.contractAddress, 5)})
          <ExternalLink className="size-3.5" strokeWidth={1.5} aria-hidden />
        </a>
      </div>

      <p className="text-sm leading-relaxed text-muted">
        This token tracks {asset.shortName} on Robinhood Chain. It is not the underlying equity.
        Trade execution via RFQ is coming soon.
      </p>

      <Button type="button" className="w-full" size="lg" disabled>
        Trade coming soon
      </Button>
    </div>
  );
}
