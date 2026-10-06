"use client";

import Image from "next/image";
import { use, useCallback, useEffect, useId, useState } from "react";
import { ArrowDown, ChevronDown, ExternalLink, Info } from "lucide-react";
import { Breadcrumbs, stockBreadcrumbItems } from "@/components/breadcrumbs";
import type { StockQuote, StockToken } from "@/lib/rhj/client";
import { explorerTokenUrl } from "@/lib/rhj/client";
import { formatUsdPrice, formatVolume } from "@/lib/rhj/format";
import { robinhoodChain } from "@/lib/chains";
import { localStockBySymbol, resolveStockAsset, stockQuantityLabel } from "@/lib/stocks/assets";
import { shortenAddress } from "@/lib/utils";
import { userFacingError } from "@/lib/user-facing-error";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TxLink } from "@/components/tx-link";
import { PriceChart } from "@/components/stocks/price-chart";
import { StockDetailSkeleton } from "@/components/stocks/stock-skeletons";
import { useStockSwap } from "@/components/stocks/use-stock-swap";
import { useChainTokenStats } from "@/components/stocks/use-chain-stats";
import { useUniswapDisplayPrices } from "@/components/stocks/use-uniswap-price";

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
    const local = localStockBySymbol(symbol);
    if (local) {
      setAsset(local);
      setQuote(null);
      setLoading(false);
      return;
    }
    try {
      const assetsRes = await fetch("/api/rhj/assets");
      if (!assetsRes.ok) {
        throw new Error("Failed to load stock tokens");
      }
      const assetsJson = (await assetsRes.json()) as { assets: StockToken[] };
      const found = resolveStockAsset(symbol, assetsJson.assets);
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
    setLogoBroken(false);
    const local = localStockBySymbol(symbol);
    if (local) {
      setAsset(local);
      setQuote(null);
      setError(null);
      setLoading(false);
      return;
    }
    void load();
    const id = window.setInterval(() => {
      void loadQuote().catch((err) => {
        setError(userFacingError(err, "This stock could not be loaded."));
      });
    }, 30_000);
    return () => window.clearInterval(id);
  }, [load, loadQuote, symbol]);

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
  };
}

export function StockDetail({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol: rawSymbol } = use(params);
  const symbol = decodeURIComponent(rawSymbol).toUpperCase();
  const detail = useStockDetail(symbol);

  if (detail.loading) {
    return <StockDetailSkeleton symbol={symbol} />;
  }

  if (detail.error && !detail.asset) {
    return <StockDetailError symbol={symbol} error={detail.error} />;
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
    />
  );
}

function StockDetailError({ symbol, error }: { symbol: string; error: string }) {
  return (
    <div className="pr-page">
      <Breadcrumbs items={stockBreadcrumbItems(symbol)} />
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
}) {
  const listed = localStockBySymbol(asset.symbol);
  const listedPrices = useUniswapDisplayPrices(listed ? [listed] : NO_LISTED_ASSETS);
  const chainStats = useChainTokenStats(Boolean(listed));
  const stat = listed ? chainStats[listed.symbol] : undefined;
  const shownQuote = listed
    ? chainStockQuote(
        asset,
        listedPrices[asset.symbol] ?? stat?.priceUsd ?? null,
        stat?.volumeUsd24h ?? null,
      )
    : quote;
  const explorerUrl = explorerTokenUrl(asset.contractAddress);
  const halted = Boolean(shownQuote?.isTradingHalt);

  return (
    <div className="pr-page gap-6">
      <Breadcrumbs items={stockBreadcrumbItems(asset.symbol)} />

      <StockDetailHeader
        asset={asset}
        logoBroken={logoBroken}
        onLogoError={onLogoError}
        halted={halted}
      />

      <div>
        <p className="pr-display pr-money text-4xl tracking-tight sm:text-5xl">
          {formatUsdPrice(shownQuote?.mid)}
        </p>
        <p className="mt-1 text-xs text-muted">Current price</p>
      </div>

      <PriceChart address={asset.contractAddress} symbol={asset.symbol} />

      <TodaySummary quote={shownQuote} />

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
            {asset.symbol === "ETH"
              ? "A buy delivers WETH on Robinhood Chain. It does not wrap or unwrap ETH in the wallet."
              : `This follows ${asset.shortName}. It is a token, not a share of the company.`}
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
        asset={asset}
        halted={halted}
        side={side}
        onSideChange={onSideChange}
        unit={unit}
        onUnitChange={onUnitChange}
        ticketAmount={ticketAmount}
        onTicketAmountChange={onTicketAmountChange}
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

const NO_LISTED_ASSETS: StockToken[] = [];

function chainStockQuote(
  asset: StockToken,
  mid: number | null,
  dailyTradingVolume: number | null,
): StockQuote {
  return {
    symbol: asset.symbol,
    bid: null,
    ask: null,
    mid,
    spreadPct: null,
    currency: "USD",
    dailyTradingVolume,
    isTradingHalt: false,
    generatedAt: null,
    dailyHigh: null,
    dailyLow: null,
    contractAddress: asset.contractAddress,
  };
}

export function StockTradeTicket({
  asset,
  halted,
  side,
  onSideChange,
  unit,
  onUnitChange,
  ticketAmount,
  onTicketAmountChange,
  embeddedPresentation = false,
  onPendingChange,
}: {
  asset: Pick<StockToken, "symbol" | "contractAddress" | "tokenDecimals">;
  halted: boolean;
  side: "buy" | "sell";
  onSideChange: (side: "buy" | "sell") => void;
  unit: "usd" | "shares";
  onUnitChange: (unit: "usd" | "shares") => void;
  ticketAmount: string;
  onTicketAmountChange: (value: string) => void;
  embeddedPresentation?: boolean;
  onPendingChange?: (pending: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();
  const quantityLabel = stockQuantityLabel(asset.symbol);
  const swap = useStockSwap({
    asset,
    side,
    unit,
    amount: ticketAmount,
    halted,
    onPendingChange,
  });

  return (
    <div className={ticketClassName(embeddedPresentation)}>
      {!embeddedPresentation ? (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={() => setExpanded((open) => !open)}
          className="flex min-h-11 w-full items-center justify-between gap-3 rounded-md text-sm font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground md:hidden"
        >
          <span>Trade {asset.symbol}</span>
          <span className="flex items-center gap-2 text-muted">
            <span className="text-xs font-medium">{expanded ? "Collapse" : "Buy / Sell"}</span>
            <ChevronDown
              className={expanded ? "size-4" : "size-4 rotate-180"}
              strokeWidth={2}
              aria-hidden
            />
          </span>
        </button>
      ) : null}
      <div
        id={contentId}
        className={
          embeddedPresentation
            ? "space-y-3"
            : expanded
              ? "mt-3 space-y-3 md:mt-0"
              : "hidden space-y-3 md:block"
        }
      >
        <OrderSideButtons side={side} pending={swap.pending} onSideChange={onSideChange} />
        <QuantityField
          symbol={asset.symbol}
          quantityLabel={quantityLabel}
          side={side}
          unit={unit}
          pending={swap.pending}
          quoting={swap.quoting}
          ticketAmount={ticketAmount}
          quoteAmounts={swap.quoteAmounts}
          onUnitChange={onUnitChange}
          onTicketAmountChange={onTicketAmountChange}
        />
        <SwapStatus
          notes={swap.notes}
          notice={swap.notice}
          confirmedHash={swap.confirmedHash}
          error={swap.error}
        />
        <Button
          type="button"
          className="w-full whitespace-normal text-center"
          size="lg"
          disabled={swap.disabled}
          onClick={() => void swap.submit()}
        >
          {swap.buttonLabel}
        </Button>
      </div>
    </div>
  );
}

function ticketClassName(embeddedPresentation: boolean) {
  if (embeddedPresentation) {
    return "rounded-[var(--radius-xl)] border border-border bg-panel p-4";
  }
  return "sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 rounded-[var(--radius-xl)] border border-border bg-[color-mix(in_srgb,var(--panel-solid)_94%,transparent)] p-4 backdrop-blur-md md:static md:bottom-auto";
}

function OrderSideButtons({
  side,
  pending,
  onSideChange,
}: {
  side: "buy" | "sell";
  pending: boolean;
  onSideChange: (side: "buy" | "sell") => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2" role="group" aria-label="Order side">
      <Button
        type="button"
        variant="outline"
        aria-pressed={side === "buy"}
        disabled={pending}
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
        disabled={pending}
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
  );
}

function QuantityField({
  symbol,
  quantityLabel,
  side,
  unit,
  pending,
  quoting,
  ticketAmount,
  quoteAmounts,
  onUnitChange,
  onTicketAmountChange,
}: {
  symbol: string;
  quantityLabel: "shares" | "tokens";
  side: "buy" | "sell";
  unit: "usd" | "shares";
  pending: boolean;
  quoting: boolean;
  ticketAmount: string;
  quoteAmounts: { usdg: string; quantity: string } | null;
  onUnitChange: (unit: "usd" | "shares") => void;
  onTicketAmountChange: (value: string) => void;
}) {
  const paySymbol = side === "buy" ? "USDG" : symbol;
  const receiveSymbol = side === "buy" ? symbol : "USDG";
  const payEditable = (side === "buy" && unit === "usd") || (side === "sell" && unit === "shares");
  return (
    <>
      <div className="flex items-center gap-2">
        <Switch
          id="amount-in-quantity"
          checked={unit === "shares"}
          onCheckedChange={(checked) => onUnitChange(checked ? "shares" : "usd")}
          aria-label={`Amount in ${quantityLabel}`}
          disabled={pending}
        />
        <Label htmlFor="amount-in-quantity" className="font-medium">
          Amount in {quantityLabel}
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
            Leave this off to type USDG. Turn it on to type {quantityLabel}. The other amount is the
            Uniswap quote.
          </TooltipContent>
        </Tooltip>
      </div>
      <div className="relative flex flex-col gap-1">
        <QuoteAmount
          id={payEditable ? "stock-amount" : "stock-quote-amount"}
          action="Sell"
          symbol={paySymbol}
          quantityLabel={quantityLabel}
          editable={payEditable}
          pending={pending}
          quoting={quoting}
          typed={ticketAmount}
          quoted={amountForSymbol(paySymbol, symbol, quoteAmounts)}
          onChange={onTicketAmountChange}
        />
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 flex -translate-y-1/2 justify-center">
          <span className="flex size-7 items-center justify-center rounded-full border border-border bg-panel text-muted">
            <ArrowDown className="size-3.5" strokeWidth={1.5} aria-hidden />
          </span>
        </div>
        <QuoteAmount
          id={payEditable ? "stock-quote-amount" : "stock-amount"}
          action="Buy"
          symbol={receiveSymbol}
          quantityLabel={quantityLabel}
          editable={!payEditable}
          pending={pending}
          quoting={quoting}
          typed={ticketAmount}
          quoted={amountForSymbol(receiveSymbol, symbol, quoteAmounts)}
          onChange={onTicketAmountChange}
        />
      </div>
    </>
  );
}

function amountForSymbol(
  fieldSymbol: string,
  assetSymbol: string,
  quoteAmounts: { usdg: string; quantity: string } | null,
) {
  if (!quoteAmounts) return "";
  return fieldSymbol === assetSymbol ? quoteAmounts.quantity : quoteAmounts.usdg;
}

function QuoteAmount({
  id,
  action,
  symbol,
  quantityLabel,
  editable,
  pending,
  quoting,
  typed,
  quoted,
  onChange,
}: {
  id: string;
  action: "Sell" | "Buy";
  symbol: string;
  quantityLabel: "shares" | "tokens";
  editable: boolean;
  pending: boolean;
  quoting: boolean;
  typed: string;
  quoted: string;
  onChange: (value: string) => void;
}) {
  const unitName = symbol === "USDG" ? "USDG" : quantityLabel;
  return (
    <div
      className={
        editable
          ? "rounded-md border border-border-strong bg-panel-elevated px-3 py-2.5 focus-within:border-foreground"
          : "rounded-md border border-border bg-foreground/[0.03] px-3 py-2.5"
      }
    >
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id} className="text-xs font-normal text-muted">
          {action}
          <span className="sr-only">
            {editable ? ` ${unitName}` : `, quoted ${unitName}, read only`}
          </span>
        </Label>
        <span className="pr-mono text-xs font-semibold text-foreground">{symbol}</span>
      </div>
      <Input
        id={id}
        inputMode={editable ? "decimal" : undefined}
        readOnly={!editable}
        aria-readonly={editable ? undefined : true}
        value={editable ? typed : quoted}
        onChange={editable ? (event) => onChange(event.target.value) : undefined}
        placeholder={editable ? "0" : quoting ? "…" : "0"}
        disabled={pending}
        className="mt-1 h-auto border-0 bg-transparent px-0 text-2xl font-semibold shadow-none focus-visible:ring-0 read-only:cursor-default disabled:opacity-70"
      />
    </div>
  );
}

function SwapStatus({
  notes,
  notice,
  confirmedHash,
  error,
}: {
  notes: string[];
  notice: string | null;
  confirmedHash: `0x${string}` | null;
  error: string | null;
}) {
  return (
    <>
      {notes.map((note) => (
        <p key={note} className="text-sm text-muted" role="status">
          {note}
        </p>
      ))}
      {notice ? (
        <p className="text-sm text-foreground" role="status">
          {notice}
        </p>
      ) : null}
      {confirmedHash ? (
        <TxLink chainId={robinhoodChain.id} hash={confirmedHash} className="text-xs">
          {shortenAddress(confirmedHash, 6)}
        </TxLink>
      ) : null}
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </>
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
