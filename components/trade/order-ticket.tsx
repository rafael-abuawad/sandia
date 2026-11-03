"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { LoginButton } from "@/components/login-button";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/responsive-dialog";
import { useHlAccount, useTrader, useTradingSetup } from "@/components/trade/use-hyperliquid";
import { builderFeePercent, HL_BUILDER_ADDRESS } from "@/lib/hyperliquid/config";
import { hlErrorMessage } from "@/lib/hyperliquid/errors";
import type { Market } from "@/lib/hyperliquid/markets";
import {
  defaultLeverage,
  formatMarketPrice,
  formatUsd,
  leverageSteps,
  quoteTicket,
  type Side,
} from "@/lib/hyperliquid/math";
import { useSignedInWallet } from "@/lib/use-signed-in-wallet";
import { cn } from "@/lib/utils";

const MIN_ORDER_USD = 10;

function sanitize(value: string): string {
  const cleaned = value.replace(/[^0-9.]/g, "");
  const [whole, ...rest] = cleaned.split(".");
  return rest.length ? `${whole}.${rest.join("").slice(0, 2)}` : whole;
}

export function OrderTicket({
  market,
  side,
  open,
  onOpenChange,
  initialAmount,
  initialLeverage,
}: {
  market: Market;
  side: Side;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialAmount?: string;
  initialLeverage?: number;
}) {
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-md">
        {open ? (
          <TicketBody
            key={`${market.coin}-${side}`}
            market={market}
            side={side}
            initialAmount={initialAmount}
            initialLeverage={initialLeverage}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

function TicketBody({
  market,
  side: initialSide,
  initialAmount,
  initialLeverage,
  onDone,
}: {
  market: Market;
  side: Side;
  initialAmount?: string;
  initialLeverage?: number;
  onDone: () => void;
}) {
  const { isSignedIn, address } = useSignedInWallet();
  const { data: account } = useHlAccount(address);
  const setup = useTradingSetup(address);
  const { open } = useTrader(address);
  const [side, setSide] = useState<Side>(initialSide);
  const [amount, setAmount] = useState(initialAmount ?? "");
  const [leverage, setLeverage] = useState(() => {
    const steps = leverageSteps(market.maxLeverage);
    return initialLeverage && steps.includes(initialLeverage)
      ? initialLeverage
      : defaultLeverage(market.maxLeverage);
  });
  const [busy, setBusy] = useState<"setup" | "order" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filled, setFilled] = useState<{ avgPx: number; size: number } | null>(null);
  const amountId = useId();
  const errorId = useId();

  const margin = Number(amount) || 0;
  const quote = quoteTicket({
    side,
    marginUsd: margin,
    leverage,
    markPx: market.markPx,
    szDecimals: market.szDecimals,
    maxLeverage: market.maxLeverage,
  });
  const available = account?.available ?? 0;
  const tooMuch = account !== undefined && margin > available + 1e-9;
  const tooSmall = margin > 0 && (quote?.notional ?? 0) < MIN_ORDER_USD;
  const needsStocksMargin =
    market.dex !== "" && setup.data !== undefined && setup.data.ready && !setup.data.unified;
  const verb = side === "long" ? "Long" : "Short";

  async function enable() {
    setBusy("setup");
    setError(null);
    try {
      await setup.enable();
    } catch (cause) {
      setError(hlErrorMessage(cause, "Trading could not be enabled. Try again."));
    } finally {
      setBusy(null);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!quote || tooMuch || tooSmall) return;
    setBusy("order");
    setError(null);
    try {
      setFilled(await open({ market, side, marginUsd: margin, leverage }));
    } catch (cause) {
      const message = hlErrorMessage(cause, "The order was not placed. Try again.");
      setError(message);
      // A revoked or replaced trading key sends the ticket back to setup.
      if (message.startsWith("Trading needs to be re-enabled")) void setup.refetch();
    } finally {
      setBusy(null);
    }
  }

  if (filled) {
    return (
      <>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Order filled</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {verb} {filled.size} {market.symbol} at ${formatMarketPrice(filled.avgPx)}.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <ResponsiveDialogBody className="flex justify-center py-6">
          <CheckCircle2 className="size-14 text-success" strokeWidth={1.5} aria-hidden />
        </ResponsiveDialogBody>
        <ResponsiveDialogFooter>
          <Button type="button" size="lg" className="w-full" onClick={onDone}>
            Done
          </Button>
        </ResponsiveDialogFooter>
      </>
    );
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
      <ResponsiveDialogHeader>
        <ResponsiveDialogTitle>
          {verb} {market.symbol}
        </ResponsiveDialogTitle>
        <ResponsiveDialogDescription>
          Market order at about ${formatMarketPrice(market.markPx)}.
        </ResponsiveDialogDescription>
      </ResponsiveDialogHeader>

      <ResponsiveDialogBody className="space-y-5">
        <div role="radiogroup" aria-label="Direction" className="pr-segmented pr-segmented--sides">
          {(["long", "short"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={side === value}
              data-active={side === value ? value : undefined}
              onClick={() => setSide(value)}
            >
              {value === "long" ? "Long ↑" : "Short ↓"}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <label htmlFor={amountId} className="pr-kicker flex justify-between gap-3">
            <span>Amount</span>
            {account ? (
              <span className="normal-case tracking-normal">{formatUsd(available)} available</span>
            ) : null}
          </label>
          <div className={cn("pr-amount-field", (tooMuch || tooSmall) && "border-danger")}>
            <span className="text-muted">$</span>
            <input
              id={amountId}
              inputMode="decimal"
              autoComplete="off"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(sanitize(e.target.value))}
              aria-invalid={tooMuch || tooSmall || undefined}
              aria-describedby={tooMuch || tooSmall ? errorId : undefined}
            />
          </div>
          {account && available > 0 ? (
            <div className="grid grid-cols-4 gap-2">
              {[0.1, 0.25, 0.5, 1].map((fraction) => (
                <button
                  key={fraction}
                  type="button"
                  className="pr-chip"
                  onClick={() => setAmount(String(Math.floor(available * fraction * 100) / 100))}
                >
                  {fraction === 1 ? "Max" : `${fraction * 100}%`}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <fieldset className="space-y-2">
          <legend className="pr-kicker">Leverage</legend>
          <div className="grid grid-cols-4 gap-2">
            {leverageSteps(market.maxLeverage).map((step) => (
              <button
                key={step}
                type="button"
                className="pr-chip"
                data-active={leverage === step ? "true" : undefined}
                aria-pressed={leverage === step}
                onClick={() => setLeverage(step)}
              >
                {step}x
              </button>
            ))}
          </div>
        </fieldset>

        <dl className="pr-summary">
          <div>
            <dt>Position size</dt>
            <dd>{quote ? `${formatUsd(quote.notional)} · ${quote.size} ${market.symbol}` : "—"}</dd>
          </div>
          <div>
            <dt>Liquidation near</dt>
            <dd>{quote?.liquidationPx ? `$${formatMarketPrice(quote.liquidationPx)}` : "—"}</dd>
          </div>
          <div>
            <dt>Fees</dt>
            <dd>{quote ? `≈ ${formatUsd(quote.fee)}` : "—"}</dd>
          </div>
        </dl>

        <FieldError
          id={errorId}
          message={
            error ??
            (tooMuch
              ? "That is more than your available USDC."
              : tooSmall
                ? `Positions start at $${MIN_ORDER_USD}. Raise the amount or the leverage.`
                : null)
          }
        />
        {setup.isError ? (
          <p className="text-sm text-danger" role="alert">
            Trading status could not be checked. Check your connection and reopen this ticket.
          </p>
        ) : null}
        {needsStocksMargin ? (
          <p className="text-xs text-muted" role="note">
            Stock markets need a unified account. Close open positions and enable trading again if
            this order is rejected.
          </p>
        ) : null}
      </ResponsiveDialogBody>

      <ResponsiveDialogFooter>
        {!isSignedIn ? (
          <LoginButton />
        ) : account && account.equity <= 0 ? (
          <Button asChild size="lg" className="w-full">
            <Link href="/requests/new">Add funds to trade</Link>
          </Button>
        ) : setup.data && !setup.data.ready ? (
          <div className="w-full space-y-3">
            <p className="flex gap-2 text-xs leading-relaxed text-muted">
              <ShieldCheck className="size-4 shrink-0 text-success" aria-hidden />
              One-time setup. Your wallet approves a trading key kept on this device. It can trade
              but cannot move funds.
              {HL_BUILDER_ADDRESS
                ? ` It also approves Sandia's ${builderFeePercent()} fee per trade.`
                : ""}
            </p>
            <Button
              type="button"
              size="lg"
              className="w-full"
              disabled={busy !== null || !setup.walletReady}
              onClick={() => void enable()}
            >
              {busy === "setup" ? "Confirm in your wallet…" : "Enable trading"}
            </Button>
          </div>
        ) : (
          <Button
            type="submit"
            size="lg"
            className={cn("w-full", side === "short" && "pr-btn-short")}
            disabled={busy !== null || !quote || tooMuch || tooSmall || !setup.data}
          >
            {busy === "order"
              ? "Placing order…"
              : quote
                ? `${verb} ${market.symbol} ${leverage}x`
                : "Enter an amount"}
          </Button>
        )}
      </ResponsiveDialogFooter>
    </form>
  );
}
