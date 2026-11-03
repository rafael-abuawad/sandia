import type { PositionView } from "./account";

export type PortfolioRange = "day" | "week" | "month" | "allTime";

export type HistoryPoint = { t: number; c: number };

export type PortfolioHistory = Record<
  PortfolioRange,
  { value: HistoryPoint[]; pnl: HistoryPoint[]; volume: number }
>;

type RawSeries = {
  accountValueHistory: [number, string][];
  pnlHistory: [number, string][];
  vlm: string;
};

const RANGES: PortfolioRange[] = ["day", "week", "month", "allTime"];

function points(series: [number, string][] | undefined): HistoryPoint[] {
  return (series ?? [])
    .map(([t, value]) => ({ t, c: Number(value) }))
    .filter((point) => Number.isFinite(point.c));
}

/** Hyperliquid's `portfolio` response is a list of [range, series] pairs. Missing ranges come back empty. */
export function parsePortfolio(raw: Array<[string, RawSeries]>): PortfolioHistory {
  const byRange = new Map(raw);
  return Object.fromEntries(
    RANGES.map((range) => {
      const series = byRange.get(range);
      const volume = Number(series?.vlm);
      return [
        range,
        {
          value: points(series?.accountValueHistory),
          pnl: points(series?.pnlHistory),
          volume: Number.isFinite(volume) ? volume : 0,
        },
      ];
    }),
  ) as PortfolioHistory;
}

/** Profit or loss over the range: the last cumulative PnL point. */
export function rangePnl(pnl: HistoryPoint[]): number {
  return pnl.length ? pnl[pnl.length - 1].c : 0;
}

export type AllocationSlice = { label: string; value: number; share: number };

/**
 * How the account is spread: free cash plus the margin held by each position. Shares sum to 1
 * when there is anything to show.
 */
export function allocation(available: number, positions: PositionView[]): AllocationSlice[] {
  const slices = [
    { label: "Cash", value: Math.max(0, available) },
    ...positions.map((position) => ({
      label: position.coin.replace(/^[a-z0-9]+:/, ""),
      value: Math.max(0, position.marginUsed + position.unrealizedPnl),
    })),
  ].filter((slice) => slice.value > 0);
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  if (total <= 0) return [];
  return slices
    .map((slice) => ({ ...slice, share: slice.value / total }))
    .sort((a, b) => b.value - a.value);
}
