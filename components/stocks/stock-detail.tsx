"use client";

import Image from "next/image";
import Link from "next/link";
import { use, useCallback, useEffect, useMemo, useState } from "react";
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
import { StockDetailSkeleton } from "@/components/stocks/stock-skeletons";
import { useSignedInWallet } from "@/lib/use-signed-in-wallet";
import { userFacingError } from "@/lib/user-facing-error";

const TRADE_UNAVAILABLE = "Buying and selling aren't available yet.";

function useStockDetail(symbol: string) {
  const [asset, setAsset] = useState<StockToken | null>(null);
  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logoBroken, setLogoBroken] = useState(false);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [unit, setUnit] = useState<"usd" | "shares">("usd");
  const [ticketAmount, setTicketAmount] = useState("");

  const loadQuote = useCallback(async () => {
    const quoteRes = await fetch(`/api/rhj/prices?symbol=${encodeURIComponent(symbol)}`);
    if (quoteRes.ok) {
      const quoteJson = (await quoteRes.json()) as { quote: StockQuote };
      setQuote(quoteJson.quote);
      return;
    }
    setQuote(null);
  }, [symbol]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const assetsRes = await fetch("/api/rhj/assets");
      if (!assetsRes.ok) {
        throw new Error("Failed to load stock tokens");
      }
      const assetsJson = (await assetsRes.json()) as { assets: StockToken[] };
      const found = assetsJson.assets.find((a) => a.symbol.toUpperCase() === symbol) ?? null;
      if (!found) {
        setAsset(null);
        setQuote(null);
        setError("This stock is not available.");
        return;
      }
      setAsset(found);
      await loadQuote();
    } catch (err) {
      setError(userFacingError(err, "This stock could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, [symbol, loadQuote]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => {
      void loadQuote().catch((err) => {
        setError(userFacingError(err, "This stock could not be loaded."));
      });
    }, 30_000);
    return () => window.clearInterval(id);
  }, [load, loadQuote]);

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
    estimate,
  };
}

export function StockDetail({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol: rawSymbol } = use(params);
  const symbol = decodeURIComponent(rawSymbol).toUpperCase();
  const detail = useStockDetail(symbol);
  const { ready, isSignedIn } = useSignedInWallet();

  if (detail.loading) {
    return <StockDetailSkeleton />;
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
      tradeReason={null}
      signedIn={ready ? isSignedIn : undefined}
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
  signedIn,
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
  signedIn?: boolean;
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
        <p className="mt-1 text-xs text-muted">Current price</p>
      </div>

      <PriceChart address={asset.contractAddress} symbol={asset.symbol} />

      <TodaySummary quote={quote} />

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
          <p>This follows {asset.shortName}. It is a token, not a share of the company.</p>
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
        signedIn={signedIn}
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
          {halted ? <Badge variant="danger">Paused</Badge> : <Badge variant="success">Open</Badge>}
        </div>
        <p className="truncate text-sm text-muted">{asset.shortName}</p>
      </div>
    </div>
  );
}

export function StockTradeTicket({
  symbol,
  halted,
  side,
  onSideChange,
  unit,
  onUnitChange,
  ticketAmount,
  onTicketAmountChange,
  tradeReason,
  signedIn,
  estimate,
  embeddedPresentation = false,
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
  signedIn?: boolean;
  estimate: { shares: number; usd: number } | null;
  embeddedPresentation?: boolean;
}) {
  const preview = estimate
    ? unit === "usd"
      ? `About ${estimate.shares.toLocaleString("en-US", { maximumFractionDigits: 2 })} shares`
      : `About ${formatUsdPrice(estimate.usd)}`
    : "Enter an amount to see an estimate.";
  const accountNote =
    signedIn === false ? "Sign in to buy or sell." : signedIn === true ? TRADE_UNAVAILABLE : null;
  const note = halted ? null : (accountNote ?? tradeReason);

  return (
    <div
      className={
        embeddedPresentation
          ? "space-y-3 rounded-[var(--radius-xl)] border border-border bg-panel p-4"
          : "sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 space-y-3 rounded-[var(--radius-xl)] border border-border bg-[color-mix(in_srgb,var(--panel-solid)_94%,transparent)] p-4 backdrop-blur-md md:static md:bottom-auto"
      }
    >
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
            Leave this off to type a dollar amount. Turn it on to type a number of shares.
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
      {note ? (
        <p className="text-sm text-muted" role="status">
          {note}
        </p>
      ) : null}
      <Button type="button" className="w-full" size="lg" disabled>
        {halted ? "Trading paused" : `${side === "buy" ? "Buy" : "Sell"} ${symbol}`}
      </Button>
    </div>
  );
}

function TodaySummary({ quote }: { quote: StockQuote | null }) {
  const low = quote?.dailyLow ?? null;
  const high = quote?.dailyHigh ?? null;
  const current = quote?.mid ?? null;
  const hasRange = low !== null && high !== null && current !== null;

  return (
    <div className="space-y-4">
      {hasRange ? (
        <div className="space-y-3">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs text-muted">Today&apos;s low</p>
              <p className="pr-mono mt-1 text-sm font-semibold">{formatUsdPrice(low)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted">Today&apos;s high</p>
              <p className="pr-mono mt-1 text-sm font-semibold">{formatUsdPrice(high)}</p>
            </div>
          </div>
          <div
            className="relative h-1 rounded-full bg-border"
            role="img"
            aria-label={`Current price ${formatUsdPrice(current)}, between today's low of ${formatUsdPrice(low)} and high of ${formatUsdPrice(high)}`}
          >
            <div
              className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground"
              style={{ left: `${rangePercent(low, high, current)}%` }}
            />
          </div>
        </div>
      ) : null}
      <div>
        <p className="pr-kicker">1D Volume</p>
        <p className="pr-mono mt-1 font-semibold">{formatVolume(quote?.dailyTradingVolume)}</p>
      </div>
    </div>
  );
}

function rangePercent(low: number, high: number, current: number) {
  const span = high - low;
  if (span <= 0) return 50;
  return Math.min(100, Math.max(0, ((current - low) / span) * 100));
}
