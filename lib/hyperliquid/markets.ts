import { HL_STOCKS_DEX } from "./config";
import { info, type HlAssetCtx, type HlMetaAsset } from "./info";

export type MarketGroup = "crypto" | "stocks" | "macro";

export type Market = {
  /** Hyperliquid coin name: "BTC" or "xyz:TSLA". Used for candles, positions and URLs. */
  coin: string;
  /** Ticker shown to people: "BTC", "TSLA". */
  symbol: string;
  /** Short description for search and subtitles. */
  name: string;
  dex: string;
  group: MarketGroup;
  /** Order asset id. HIP-3 ids are 100000 + dexIndex * 10000 + index. */
  assetId: number;
  szDecimals: number;
  maxLeverage: number;
  /** True when the market only allows isolated margin. */
  isolatedOnly: boolean;
  markPx: number;
  prevDayPx: number;
  /** Fractional 24h change, 0.012 = +1.2%. */
  change24h: number;
  volume24h: number;
  /** Hourly funding rate as a fraction. */
  funding: number;
  openInterestUsd: number;
  keywords: string[];
};

type Annotation = { category?: string; displayName?: string; keywords?: string[] };

const STOCK_CATEGORIES = new Set(["stocks", "preipo"]);

function num(value: string | null | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function hip3AssetId(dexIndex: number, index: number): number {
  return 100_000 + dexIndex * 10_000 + index;
}

function groupFor(dex: string, annotation: Annotation | undefined): MarketGroup {
  if (!dex) return "crypto";
  const category = annotation?.category?.toLowerCase();
  if (category && STOCK_CATEGORIES.has(category)) return "stocks";
  if (category === "crypto") return "crypto";
  return "macro";
}

/** Turn one dex's `metaAndAssetCtxs` into tradable markets. Delisted and dead markets are dropped. */
export function normalizeMarkets(input: {
  dex: string;
  dexIndex: number;
  universe: HlMetaAsset[];
  ctxs: HlAssetCtx[];
  annotations?: Map<string, Annotation>;
}): Market[] {
  const markets: Market[] = [];
  input.universe.forEach((asset, index) => {
    const ctx = input.ctxs[index];
    if (!ctx || asset.isDelisted) return;
    const markPx = num(ctx.markPx);
    if (markPx <= 0) return;
    const prevDayPx = num(ctx.prevDayPx);
    const annotation = input.annotations?.get(asset.name);
    const symbol = annotation?.displayName || asset.name.replace(/^[a-z0-9]+:/, "");
    markets.push({
      coin: asset.name,
      symbol,
      name: annotation?.keywords?.[0] ? titleCase(annotation.keywords[0]) : symbol,
      dex: input.dex,
      group: groupFor(input.dex, annotation),
      assetId: input.dex ? hip3AssetId(input.dexIndex, index) : index,
      szDecimals: asset.szDecimals,
      maxLeverage: asset.maxLeverage,
      isolatedOnly:
        Boolean(asset.onlyIsolated) ||
        asset.marginMode === "strictIsolated" ||
        asset.marginMode === "noCross",
      markPx,
      prevDayPx,
      change24h: prevDayPx > 0 ? markPx / prevDayPx - 1 : 0,
      volume24h: num(ctx.dayNtlVlm),
      funding: num(ctx.funding),
      openInterestUsd: num(ctx.openInterest) * markPx,
      keywords: annotation?.keywords ?? [],
    });
  });
  return markets;
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** All markets Sandia offers: validator perps plus the HIP-3 stocks dex. Sorted by 24h volume. */
export async function fetchMarkets(): Promise<Market[]> {
  const [main, stocks, dexs, annotations] = await Promise.all([
    info.metaAndAssetCtxs(),
    info.metaAndAssetCtxs(HL_STOCKS_DEX),
    info.perpDexs(),
    info.perpConciseAnnotations().catch(() => []),
  ]);
  const dexIndex = dexs.findIndex((dex) => dex?.name === HL_STOCKS_DEX);
  const notes = new Map(annotations);
  const markets = [
    ...normalizeMarkets({ dex: "", dexIndex: 0, universe: main[0].universe, ctxs: main[1] }),
    ...(dexIndex > 0
      ? normalizeMarkets({
          dex: HL_STOCKS_DEX,
          dexIndex,
          universe: stocks[0].universe,
          ctxs: stocks[1],
          annotations: notes,
        })
      : []),
  ];
  return markets.sort((a, b) => b.volume24h - a.volume24h);
}

export function filterMarkets(markets: Market[], group: MarketGroup, query: string): Market[] {
  const q = query.trim().toLowerCase();
  return markets.filter((market) => {
    if (q) {
      return [market.symbol, market.name, market.coin, ...market.keywords].some((label) =>
        label.toLowerCase().includes(q),
      );
    }
    return market.group === group;
  });
}

/** URL segment for a market. "xyz:TSLA" → "xyz:TSLA" encoded. */
export function marketHref(coin: string): string {
  return `/trade/${encodeURIComponent(coin)}`;
}
