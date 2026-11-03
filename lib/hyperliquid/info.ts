import { HL_API_URL } from "./config";

/** Minimal typed client for Hyperliquid's public `/info` endpoint. Works in the browser and in Convex. */

export type HlMetaAsset = {
  name: string;
  szDecimals: number;
  maxLeverage: number;
  onlyIsolated?: boolean;
  isDelisted?: boolean;
  marginMode?: string;
};

export type HlAssetCtx = {
  funding: string;
  openInterest: string;
  prevDayPx: string;
  dayNtlVlm: string;
  markPx: string;
  midPx?: string | null;
  oraclePx: string;
};

export type HlPosition = {
  coin: string;
  szi: string;
  entryPx: string;
  positionValue: string;
  unrealizedPnl: string;
  returnOnEquity: string;
  liquidationPx: string | null;
  marginUsed: string;
  leverage: { type: "cross" | "isolated"; value: number };
};

export type HlClearinghouseState = {
  marginSummary: { accountValue: string; totalNtlPos: string; totalMarginUsed: string };
  withdrawable: string;
  assetPositions: Array<{ position: HlPosition }>;
};

export type HlSpotState = {
  balances: Array<{ coin: string; total: string; hold: string }>;
};

export type HlCandle = { t: number; o: string; h: string; l: string; c: string; v: string };

export type HlFill = {
  coin: string;
  px: string;
  sz: string;
  side: "B" | "A";
  time: number;
  dir: string;
  closedPnl: string;
  fee: string;
  builderFee?: string;
  hash: string;
  oid: number;
};

export type HlLedgerUpdate = {
  time: number;
  hash: string;
  delta: {
    type: string;
    usdc?: string;
    amount?: string;
    usdcValue?: string;
    user?: string;
    destination?: string;
    token?: string;
  };
};

export type HlExtraAgent = { name: string; address: string; validUntil: number };

export async function hlInfo<T>(body: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${HL_API_URL}/info`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    throw new Error(`Hyperliquid ${String(body.type)} failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export const info = {
  metaAndAssetCtxs: (dex?: string) =>
    hlInfo<[{ universe: HlMetaAsset[] }, HlAssetCtx[]]>({
      type: "metaAndAssetCtxs",
      ...(dex ? { dex } : {}),
    }),
  perpDexs: () => hlInfo<Array<{ name: string; fullName: string } | null>>({ type: "perpDexs" }),
  perpConciseAnnotations: () =>
    hlInfo<Array<[string, { category?: string; displayName?: string; keywords?: string[] }]>>({
      type: "perpConciseAnnotations",
    }),
  clearinghouseState: (user: string, dex?: string) =>
    hlInfo<HlClearinghouseState>({ type: "clearinghouseState", user, ...(dex ? { dex } : {}) }),
  spotClearinghouseState: (user: string) =>
    hlInfo<HlSpotState>({ type: "spotClearinghouseState", user }),
  candleSnapshot: (coin: string, interval: string, startTime: number) =>
    hlInfo<HlCandle[]>({ type: "candleSnapshot", req: { coin, interval, startTime } }),
  userFills: (user: string) => hlInfo<HlFill[]>({ type: "userFills", user, aggregateByTime: true }),
  userNonFundingLedgerUpdates: (user: string, startTime: number) =>
    hlInfo<HlLedgerUpdate[]>({ type: "userNonFundingLedgerUpdates", user, startTime }),
  extraAgents: (user: string) => hlInfo<HlExtraAgent[]>({ type: "extraAgents", user }),
  maxBuilderFee: (user: string, builder: string) =>
    hlInfo<number>({ type: "maxBuilderFee", user, builder }),
  userDexAbstraction: (user: string) =>
    hlInfo<boolean | null>({ type: "userDexAbstraction", user }),
};
