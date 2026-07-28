import { robinhoodChain } from "@/lib/chains";

export const RHJ_BASE_URL = "https://api.robinhood.com/rhj";
export const RHJ_CHAIN_ID = robinhoodChain.id;

export type RhjAssetStatus =
  | "ASSET_STATUS_UNSPECIFIED"
  | "ASSET_STATUS_ACTIVE"
  | "ASSET_STATUS_INACTIVE";

export type RhjDeployment = {
  contractAddress: string;
  chainId: number;
};

export type RhjAsset = {
  id: string;
  tokenSymbol: string;
  tokenName: string;
  deployments: RhjDeployment[];
  currentMultiplier: string;
  pendingMultiplier: string;
  pendingMultiplierEffectiveTime?: string;
  logoUrl?: string;
  tradingCapabilities?: unknown;
  status: RhjAssetStatus;
};

export type RhjQuote = {
  tokenSymbol: string;
  deployments: RhjDeployment[];
  bid: string;
  ask: string;
  currency: string;
  dailyTradingVolume: string;
  isTradingHalt: boolean;
  generatedAt: string;
  dailyHigh?: string;
  dailyLow?: string;
  mintBurnTokenVolume?: string;
  mintBurnUsdVolume?: string;
};

/** Normalized stock token on Robinhood Chain for UI consumption. */
export type StockToken = {
  id: string;
  symbol: string;
  name: string;
  /** Display name without the "• Robinhood Token" suffix when present. */
  shortName: string;
  contractAddress: string;
  chainId: number;
  logoUrl: string | null;
  currentMultiplier: string;
  status: RhjAssetStatus;
};

export type StockQuote = {
  symbol: string;
  bid: number | null;
  ask: number | null;
  mid: number | null;
  spreadPct: number | null;
  currency: string;
  dailyTradingVolume: number | null;
  isTradingHalt: boolean;
  generatedAt: string | null;
  dailyHigh: number | null;
  dailyLow: number | null;
  contractAddress: string | null;
};

function parseDecimal(value: string | undefined | null): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

export function shortTokenName(tokenName: string): string {
  return tokenName.replace(/\s*•\s*Robinhood Token\s*$/i, "").trim() || tokenName;
}

export function toStockToken(asset: RhjAsset): StockToken | null {
  const deployment = asset.deployments.find((d) => d.chainId === RHJ_CHAIN_ID);
  if (!deployment) return null;
  if (asset.status !== "ASSET_STATUS_ACTIVE") return null;

  return {
    id: asset.id,
    symbol: asset.tokenSymbol,
    name: asset.tokenName,
    shortName: shortTokenName(asset.tokenName),
    contractAddress: deployment.contractAddress,
    chainId: deployment.chainId,
    logoUrl: asset.logoUrl ?? null,
    currentMultiplier: asset.currentMultiplier,
    status: asset.status,
  };
}

export function toStockQuote(quote: RhjQuote): StockQuote {
  const bid = parseDecimal(quote.bid);
  const ask = parseDecimal(quote.ask);
  const mid = bid !== null && ask !== null ? (bid + ask) / 2 : (bid ?? ask);
  const spreadPct =
    mid !== null && mid > 0 && bid !== null && ask !== null ? ((ask - bid) / mid) * 100 : null;
  const deployment = quote.deployments.find((d) => d.chainId === RHJ_CHAIN_ID);

  return {
    symbol: quote.tokenSymbol,
    bid,
    ask,
    mid,
    spreadPct,
    currency: quote.currency || "USD",
    dailyTradingVolume: parseDecimal(quote.dailyTradingVolume),
    isTradingHalt: Boolean(quote.isTradingHalt),
    generatedAt: quote.generatedAt ?? null,
    dailyHigh: parseDecimal(quote.dailyHigh),
    dailyLow: parseDecimal(quote.dailyLow),
    contractAddress: deployment?.contractAddress ?? null,
  };
}

async function rhjGet<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${RHJ_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`RHJ ${path} failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export async function fetchRhjAssets(): Promise<RhjAsset[]> {
  const data = await rhjGet<{ assets: RhjAsset[] }>("/assets", {
    next: { revalidate: 300 },
  });
  return data.assets ?? [];
}

export async function fetchRhjQuotes(): Promise<RhjQuote[]> {
  const data = await rhjGet<{ quotes: RhjQuote[] }>("/prices", {
    next: { revalidate: 15 },
  });
  return data.quotes ?? [];
}

export async function fetchRhjQuote(symbol: string): Promise<RhjQuote | null> {
  const encoded = encodeURIComponent(symbol.toUpperCase());
  const data = await rhjGet<{ quotes: RhjQuote[] }>(`/prices/${encoded}`, {
    next: { revalidate: 15 },
  });
  const quotes = data.quotes ?? [];
  return quotes[0] ?? null;
}

export async function listRobinhoodStockTokens(): Promise<StockToken[]> {
  const assets = await fetchRhjAssets();
  return assets
    .map(toStockToken)
    .filter((t): t is StockToken => t !== null)
    .sort((a, b) => a.symbol.localeCompare(b.symbol));
}

export async function listRobinhoodStockQuotes(): Promise<StockQuote[]> {
  const quotes = await fetchRhjQuotes();
  const result: StockQuote[] = [];
  for (const q of quotes) {
    if (!q.deployments.some((d) => d.chainId === RHJ_CHAIN_ID)) continue;
    result.push(toStockQuote(q));
  }
  return result;
}

export function explorerTokenUrl(contractAddress: string): string {
  return `${robinhoodChain.blockExplorers!.default.url}/token/${contractAddress}`;
}
