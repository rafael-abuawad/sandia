"use client";

import Image from "next/image";
import Link from "next/link";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ROBINHOOD_USDG } from "@/lib/destination";
import { ArrowLeft, ChevronDown, ExternalLink, Info } from "lucide-react";
import type { StockQuote, StockToken } from "@/lib/rhj/client";
import { explorerTokenUrl } from "@/lib/rhj/client";
import { formatUsdPrice, formatVolume } from "@/lib/rhj/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PriceChart } from "@/components/stocks/price-chart";

function useStockDetail(symbol: string) {
  const [asset, setAsset] = useState<StockToken | null>(null);
  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logoBroken, setLogoBroken] = useState(false);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [unit, setUnit] = useState<"usd" | "shares">("usd");
  const [ticketAmount, setTicketAmount] = useState("");
  const probeQuote = useAction(api.zerox.probeQuote);
  const [tradeReason, setTradeReason] = useState<string | null>(
    "Checking whether 0x can execute this token.",
  );

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
      try {
        const probe = await probeQuote({
          sellToken: ROBINHOOD_USDG.address,
          buyToken: found.contractAddress,
          sellAmount: "1000000",
          taker: "0x0000000000000000000000000000000000000001",
        });
        setTradeReason(
          probe.ok && probe.liquidityAvailable
            ? null
            : (probe.reason ?? "0x did not return executable liquidity"),
        );
      } catch (probeError) {
        setTradeReason(
          probeError instanceof Error ? probeError.message : "0x quote could not be loaded",
        );
      }

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
  }, [symbol, probeQuote]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(id);
  }, [load]);

  const estimate = useMemo(() => {
    const n = Number.parseFloat(ticketAmount);
    const mid = quote?.mid;
    if (!Number.isFinite(n) || n <= 0 || mid == null || mid <= 0) return null;
    if (unit === "usd") {
      return { shares: n / mid, usd: n };
    }
    return { shares: n, usd: n * mid };
  }, [ticketAmount, unit, quote?.mid]);

  return {
    asset,
    quote,
    loading,
    error,
    logoBroken,
    setLogoBroken,
    side,
    setSide,
    unit,
    setUnit,
    ticketAmount,
    setTicketAmount,
    tradeReason,
    estimate,
  };
}

export function StockDetail({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol: rawSymbol } = use(params);
  const symbol = decodeURIComponent(rawSymbol).toUpperCase();
  const detail = useStockDetail(symbol);

  if (detail.loading) {
    return <p className="text-sm text-muted">Loading {symbol}…</p>;
  }

  if (detail.error && !detail.asset) {
    return <StockDetailError error={detail.error} />;
  }

  if (!detail.asset) return null;

  return (
    <StockDetailLoaded
      asset={detail.asset}
      quote={detail.quote}
      logoBroken={detail.logoBroken}
      onLogoError={() => detail.setLogoBroken(true)}
      side={detail.side}
      onSideChange={detail.setSide}
      unit={detail.unit}
      onUnitChange={detail.setUnit}
      ticketAmount={detail.ticketAmount}
      onTicketAmountChange={detail.setTicketAmount}
      tradeReason={detail.tradeReason}
      estimate={detail.estimate}
    />
  );
}

function StockDetailError({ error }: { error: string }) {
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

function StockDetailLoaded({
  asset,
  quote,
  logoBroken,
  onLogoError,
  side,
  onSideChange,
  unit,
  onUnitChange,
  ticketAmount,
  onTicketAmountChange,
  tradeReason,
  estimate,
}: {
  asset: StockToken;
  quote: StockQuote | null;
  logoBroken: boolean;
  onLogoError: () => void;
  side: "buy" | "sell";
  onSideChange: (side: "buy" | "sell") => void;
  unit: "usd" | "shares";
  onUnitChange: (unit: "usd" | "shares") => void;
  ticketAmount: string;
  onTicketAmountChange: (value: string) => void;
  tradeReason: string | null;
  estimate: { shares: number; usd: number } | null;
}) {
  const explorerUrl = explorerTokenUrl(asset.contractAddress);
  const halted = Boolean(quote?.isTradingHalt);

  return (
    <div className="pr-page gap-6">
      <Link
        href="/stocks"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="size-4" strokeWidth={1.5} aria-hidden />
        Back
      </Link>

      <StockDetailHeader
        asset={asset}
        logoBroken={logoBroken}
        onLogoError={onLogoError}
        halted={halted}
      />

      <div>
        <p className="pr-display pr-money text-4xl tracking-tight sm:text-5xl">
          {formatUsdPrice(quote?.mid)}
        </p>
        <p className="mt-1 text-xs text-muted">Mid quote · not the underlying share</p>
      </div>

      <PriceChart address={asset.contractAddress} symbol={asset.symbol} />

      {quote?.dailyLow != null && quote.dailyHigh != null && quote.mid != null ? (
        <DayRangeBar low={quote.dailyLow} high={quote.dailyHigh} current={quote.mid} />
      ) : null}

      <dl className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="pr-kicker">Bid / Ask</dt>
          <dd className="pr-mono mt-1 font-semibold">
            {formatUsdPrice(quote?.bid)} / {formatUsdPrice(quote?.ask)}
          </dd>
        </div>
        <div>
          <dt className="pr-kicker">1D Volume</dt>
          <dd className="pr-mono mt-1 font-semibold">{formatVolume(quote?.dailyTradingVolume)}</dd>
        </div>
      </dl>

      <details className="group border-t border-border pt-4">
        <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
          About this token
          <ChevronDown
            className="size-4 text-muted transition-transform duration-[var(--duration)] ease-[var(--ease-out)] group-open:rotate-180"
            strokeWidth={1.5}
            aria-hidden
          />
        </summary>
        <div className="mt-3 space-y-2 text-sm text-muted">
          <p>
            This token tracks {asset.shortName} on Robinhood Chain. It is not the underlying equity.
          </p>
          <a
            href={explorerUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-foreground underline-offset-2 hover:underline"
          >
            View contract on explorer
            <ExternalLink className="size-3.5" strokeWidth={1.5} aria-hidden />
          </a>
        </div>
      </details>

      <StockTradeTicket
        symbol={asset.symbol}
        halted={halted}
        side={side}
        onSideChange={onSideChange}
        unit={unit}
        onUnitChange={onUnitChange}
        ticketAmount={ticketAmount}
        onTicketAmountChange={onTicketAmountChange}
        tradeReason={tradeReason}
        estimate={estimate}
      />
    </div>
  );
}

function StockDetailHeader({
  asset,
  logoBroken,
  onLogoError,
  halted,
}: {
  asset: StockToken;
  logoBroken: boolean;
  onLogoError: () => void;
  halted: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      {asset.logoUrl && !logoBroken ? (
        <Image
          src={asset.logoUrl}
          alt=""
          width={40}
          height={40}
          className="size-10 shrink-0 rounded-full ring-1 ring-border"
          unoptimized
          onError={onLogoError}
        />
      ) : (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-panel text-xs font-bold uppercase text-muted ring-1 ring-border">
          {asset.symbol.slice(0, 2)}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h1 className="pr-display text-xl">{asset.symbol}</h1>
          {halted ? <Badge variant="danger">Halted</Badge> : <Badge variant="success">Open</Badge>}
        </div>
        <p className="truncate text-sm text-muted">{asset.shortName}</p>
      </div>
    </div>
  );
}

function StockTradeTicket({
  symbol,
  halted,
  side,
  onSideChange,
  unit,
  onUnitChange,
  ticketAmount,
  onTicketAmountChange,
  tradeReason,
  estimate,
}: {
  symbol: string;
  halted: boolean;
  side: "buy" | "sell";
  onSideChange: (side: "buy" | "sell") => void;
  unit: "usd" | "shares";
  onUnitChange: (unit: "usd" | "shares") => void;
  ticketAmount: string;
  onTicketAmountChange: (value: string) => void;
  tradeReason: string | null;
  estimate: { shares: number; usd: number } | null;
}) {
  const preview = estimate
    ? unit === "usd"
      ? `≈ ${estimate.shares.toLocaleString("en-US", { maximumFractionDigits: 6 })} shares at mid`
      : `≈ ${formatUsdPrice(estimate.usd)} at mid`
    : "Enter an amount to preview the fill.";

  return (
    <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 space-y-3 rounded-[var(--radius-xl)] border border-border bg-[color-mix(in_srgb,var(--panel-solid)_94%,transparent)] p-4 backdrop-blur-md md:static md:bottom-auto">
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Order side">
        <Button
          type="button"
          variant="outline"
          aria-pressed={side === "buy"}
          onClick={() => onSideChange("buy")}
          className={
            side === "buy"
              ? "border-green-600 bg-green-600 text-white hover:bg-green-700 hover:text-white"
              : "border-green-600/40 text-green-700 hover:bg-green-50 hover:text-green-800"
          }
        >
          Buy
        </Button>
        <Button
          type="button"
          variant="outline"
          aria-pressed={side === "sell"}
          onClick={() => onSideChange("sell")}
          className={
            side === "sell"
              ? "border-red-600 bg-red-600 text-white hover:bg-red-700 hover:text-white"
              : "border-red-600/40 text-red-700 hover:bg-red-50 hover:text-red-800"
          }
        >
          Sell
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Switch
          id="amount-in-shares"
          checked={unit === "shares"}
          onCheckedChange={(checked) => onUnitChange(checked ? "shares" : "usd")}
          aria-label="Amount in shares"
        />
        <Label htmlFor="amount-in-shares" className="font-medium">
          Amount in shares
        </Label>
        <Tooltip>
          <TooltipTrigger
            type="button"
            className="inline-flex size-6 items-center justify-center rounded-md text-muted hover:bg-foreground/5 hover:text-foreground"
            aria-label="About amount unit"
          >
            <Info className="size-3.5" strokeWidth={1.5} aria-hidden />
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            Off: enter a USD amount. On: enter a share quantity. The preview uses the current mid
            quote.
          </TooltipContent>
        </Tooltip>
      </div>
      <div className="space-y-2">
        <Label htmlFor="stock-amount">{unit === "usd" ? "Amount in USD" : "Shares"}</Label>
        <Input
          id="stock-amount"
          inputMode="decimal"
          value={ticketAmount}
          onChange={(e) => onTicketAmountChange(e.target.value)}
          placeholder={unit === "usd" ? "0.00" : "0"}
        />
        <p className="text-xs text-muted">{preview}</p>
      </div>
      <Button type="button" className="w-full" size="lg" disabled>
        {halted
          ? "Trading halted"
          : (tradeReason ?? `${side === "buy" ? "Buy" : "Sell"} ${symbol}`)}
      </Button>
      <p className="text-xs text-muted">
        The execution price is a 0x quote, not the Robinhood mid. The mid is a reference only. Buy
        and sell stay off until a firm quote reports liquidity.
      </p>
    </div>
  );
}

function DayRangeBar({ low, high, current }: { low: number; high: number; current: number }) {
  const span = high - low;
  const pct = span > 0 ? Math.min(100, Math.max(0, ((current - low) / span) * 100)) : 50;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted">
        <span className="pr-mono">{formatUsdPrice(low)}</span>
        <span>Day range</span>
        <span className="pr-mono">{formatUsdPrice(high)}</span>
      </div>
      <div className="relative h-1 rounded-full bg-border">
        <div
          className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground"
          style={{ left: `${pct}%` }}
        />
      </div>
    </div>
  );
}
