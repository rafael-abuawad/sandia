import { formatPrice, formatSize } from "@nktkas/hyperliquid/utils";
import { builderFeeRate, HL_MARKET_SLIPPAGE, HL_TAKER_FEE_RATE } from "./config";

export type Side = "long" | "short";

/** Leverage presets that fit a market's cap. Always includes 1x and the max. */
export function leverageSteps(maxLeverage: number): number[] {
  const presets = [1, 2, 3, 5, 10, 20, 25, 40, 50];
  const steps = presets.filter((step) => step <= maxLeverage);
  if (!steps.includes(maxLeverage)) steps.push(maxLeverage);
  return steps;
}

/** Default leverage: 5x where allowed, otherwise the cap. */
export function defaultLeverage(maxLeverage: number): number {
  return Math.min(5, Math.max(1, maxLeverage));
}

export type TicketQuote = {
  /** Position notional in USD. */
  notional: number;
  /** Size in coin units, already truncated to the market's lot size. */
  size: string;
  /** IOC limit price that makes this a market order. */
  limitPx: string;
  /** Estimated taker plus builder fee in USD. */
  fee: number;
  builderFee: number;
  /** Rough liquidation price for an isolated position of this size. */
  liquidationPx: number | null;
};

/**
 * Size a market order from the margin a person wants to put in.
 * `marginUsd * leverage` is the notional; size is notional / mark, truncated to lot size.
 */
export function quoteTicket(input: {
  side: Side;
  marginUsd: number;
  leverage: number;
  markPx: number;
  szDecimals: number;
  maxLeverage: number;
  slippage?: number;
}): TicketQuote | null {
  const { side, marginUsd, leverage, markPx, szDecimals } = input;
  if (!(marginUsd > 0) || !(markPx > 0) || !(leverage >= 1)) return null;
  const slippage = input.slippage ?? HL_MARKET_SLIPPAGE;
  let size: string;
  try {
    size = formatSize((marginUsd * leverage) / markPx, szDecimals);
  } catch {
    return null;
  }
  const sizeNum = Number(size);
  if (!(sizeNum > 0)) return null;
  const notional = sizeNum * markPx;
  const limit = side === "long" ? markPx * (1 + slippage) : markPx * (1 - slippage);
  const builderFee = notional * builderFeeRate();
  return {
    notional,
    size,
    limitPx: formatPrice(limit, szDecimals),
    fee: notional * HL_TAKER_FEE_RATE + builderFee,
    builderFee,
    liquidationPx: estimateLiquidationPx({
      side,
      entryPx: markPx,
      leverage,
      maxLeverage: input.maxLeverage,
    }),
  };
}

/**
 * Isolated-margin liquidation estimate. Maintenance margin is half the initial margin at max
 * leverage, as Hyperliquid defines it. Cross positions liquidate later than this.
 */
export function estimateLiquidationPx(input: {
  side: Side;
  entryPx: number;
  leverage: number;
  maxLeverage: number;
}): number | null {
  const { side, entryPx, leverage, maxLeverage } = input;
  if (!(entryPx > 0) || !(leverage >= 1) || !(maxLeverage >= 1)) return null;
  const maintenance = 1 / (2 * maxLeverage);
  const initial = 1 / leverage;
  const sign = side === "long" ? 1 : -1;
  const px = entryPx * (1 - (sign * (initial - maintenance)) / (1 - sign * maintenance));
  return px > 0 ? px : null;
}

/** Reduce-only IOC price that closes a position at market. */
export function closeLimitPx(input: {
  positionSize: number;
  markPx: number;
  szDecimals: number;
  slippage?: number;
}): string {
  const slippage = input.slippage ?? HL_MARKET_SLIPPAGE;
  // A long closes with a sell, so it accepts a lower price, and the reverse for shorts.
  const px = input.positionSize > 0 ? input.markPx * (1 - slippage) : input.markPx * (1 + slippage);
  return formatPrice(px, input.szDecimals);
}

/** Display price with sensible precision for anything from BTC to sub-cent memecoins. */
export function formatMarketPrice(px: number): string {
  if (!Number.isFinite(px)) return "—";
  const abs = Math.abs(px);
  const digits = abs >= 1000 ? 2 : abs >= 1 ? 4 : abs >= 0.01 ? 5 : 7;
  return px.toLocaleString("en-US", {
    minimumFractionDigits: abs >= 1000 ? 2 : 2,
    maximumFractionDigits: digits,
  });
}

export function formatUsd(value: number, options?: { sign?: boolean; compact?: boolean }): string {
  if (!Number.isFinite(value)) return "—";
  const formatted = Math.abs(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    notation: options?.compact ? "compact" : "standard",
    maximumFractionDigits: options?.compact ? 1 : 2,
    minimumFractionDigits: options?.compact ? 0 : 2,
  });
  if (value < 0) return `-${formatted}`;
  return options?.sign && value > 0 ? `+${formatted}` : formatted;
}

export function formatPercent(fraction: number, options?: { sign?: boolean }): string {
  if (!Number.isFinite(fraction)) return "—";
  const value = (fraction * 100).toFixed(2);
  return options?.sign !== false && fraction > 0 ? `+${value}%` : `${value}%`;
}
