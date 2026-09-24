import { STEAKHOUSE_USDG_VAULT } from "./vault-gate";

export const MORPHO_GRAPHQL_URL = "https://api.morpho.org/graphql";
export const STEAKHOUSE_CHAIN_ID = 4663;

/** One indexed read of the Steakhouse USDG Morpho Vault V2. */
export const STEAKHOUSE_VAULT_QUERY = `
  query SteakhouseUsdgVault {
    vaultV2ByAddress(
      address: "${STEAKHOUSE_USDG_VAULT}"
      chainId: ${STEAKHOUSE_CHAIN_ID}
    ) {
      avgNetApy
      totalAssetsUsd
      liquidityUsd
      adapters(first: 10) {
        items {
          ... on MorphoMarketV1Adapter {
            positions(first: 20) {
              items {
                state {
                  supplyAssetsUsd
                }
                market {
                  collateralAsset {
                    symbol
                    logoURI
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

export type ExposureRow = {
  symbol: string;
  usd: number;
  logoUrl: string | null;
};

export type VaultSnapshot = {
  netApy: number | null;
  totalAssetsUsd: number | null;
  liquidityUsd: number | null;
  exposure: ExposureRow[];
};

export type MarketExposure = {
  symbol?: string | null;
  usd?: number | null;
  logoUrl?: string | null;
};

/** Morpho returns avgNetApy as a decimal. 0.0361 is 3.61%. */
export function formatNetApy(avgNetApy: number | null | undefined): string {
  if (typeof avgNetApy !== "number" || !Number.isFinite(avgNetApy)) return "—";
  return `${(avgNetApy * 100).toFixed(2)}%`;
}

export function formatCompactUsd(usd: number | null | undefined): string {
  if (typeof usd !== "number" || !Number.isFinite(usd)) return "—";
  const abs = Math.abs(usd);
  const sign = usd < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${sign}$${(abs / 1_000).toFixed(2)}K`;
  return usd.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Sum supply by collateral and drop markets that have none. */
export function aggregateExposure(positions: MarketExposure[]): ExposureRow[] {
  const bySymbol = new Map<string, ExposureRow>();
  for (const position of positions) {
    const symbol = position.symbol?.trim();
    const usd = position.usd;
    if (!symbol || typeof usd !== "number" || !Number.isFinite(usd) || usd <= 0) continue;
    const existing = bySymbol.get(symbol);
    if (existing) {
      existing.usd += usd;
      if (!existing.logoUrl && position.logoUrl) existing.logoUrl = position.logoUrl;
      continue;
    }
    bySymbol.set(symbol, {
      symbol,
      usd,
      logoUrl: position.logoUrl ?? null,
    });
  }
  return [...bySymbol.values()].sort((a, b) => b.usd - a.usd);
}

export function parseMorphoVaultSnapshot(
  payload: unknown,
): { ok: true; snapshot: VaultSnapshot } | { ok: false; reason: string } {
  if (typeof payload !== "object" || payload === null) {
    return { ok: false, reason: "Morpho returned an empty snapshot" };
  }
  const body = payload as { data?: unknown; errors?: { message?: string }[] };
  const vault = readVault(body.data);
  if (!vault) {
    const message = body.errors?.find((error) => error.message)?.message;
    return { ok: false, reason: message || "Steakhouse USDG vault was not found" };
  }
  return {
    ok: true,
    snapshot: {
      netApy: finiteNumber(vault.avgNetApy),
      totalAssetsUsd: finiteNumber(vault.totalAssetsUsd),
      liquidityUsd: finiteNumber(vault.liquidityUsd),
      exposure: aggregateExposure(readPositions(vault.adapters)),
    },
  };
}

function readVault(data: unknown): Record<string, unknown> | null {
  if (typeof data !== "object" || data === null || !("vaultV2ByAddress" in data)) return null;
  const vault = (data as { vaultV2ByAddress: unknown }).vaultV2ByAddress;
  if (typeof vault !== "object" || vault === null) return null;
  return vault as Record<string, unknown>;
}

function readPositions(adapters: unknown): MarketExposure[] {
  if (typeof adapters !== "object" || adapters === null || !("items" in adapters)) return [];
  const items = (adapters as { items: unknown }).items;
  if (!Array.isArray(items)) return [];
  const positions: MarketExposure[] = [];
  for (const adapter of items) {
    if (typeof adapter !== "object" || adapter === null || !("positions" in adapter)) continue;
    const nested = (adapter as { positions: unknown }).positions;
    if (typeof nested !== "object" || nested === null || !("items" in nested)) continue;
    const positionItems = (nested as { items: unknown }).items;
    if (!Array.isArray(positionItems)) continue;
    for (const position of positionItems) {
      positions.push(readPosition(position));
    }
  }
  return positions;
}

function readPosition(position: unknown): MarketExposure {
  if (typeof position !== "object" || position === null) return {};
  const record = position as {
    state?: { supplyAssetsUsd?: unknown };
    market?: {
      collateralAsset?: { symbol?: unknown; logoURI?: unknown; logoUri?: unknown } | null;
    };
  };
  const asset = record.market?.collateralAsset;
  const logo = asset?.logoURI ?? asset?.logoUri;
  return {
    symbol: typeof asset?.symbol === "string" ? asset.symbol : null,
    usd: finiteNumber(record.state?.supplyAssetsUsd),
    logoUrl: typeof logo === "string" && logo.length > 0 ? logo : null,
  };
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}
