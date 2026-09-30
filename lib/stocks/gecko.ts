import { LOCAL_CHAIN_STOCKS } from "@/lib/stocks/assets";

const GECKO_NETWORK = "robinhood";

export type ChainTokenStat = {
  symbol: string;
  priceUsd: number | null;
  volumeUsd24h: number | null;
};

/** Read GeckoTerminal's multi-token payload. A zero 24h volume is a real value. */
export function parseGeckoTokenStats(
  body: unknown,
): { address: string; priceUsd: number | null; volumeUsd24h: number | null }[] {
  if (!isRecord(body) || !Array.isArray(body.data)) return [];
  const stats = [];
  for (const row of body.data) {
    if (!isRecord(row) || !isRecord(row.attributes)) continue;
    const address = typeof row.attributes.address === "string" ? row.attributes.address : null;
    if (!address) continue;
    const volume = isRecord(row.attributes.volume_usd) ? row.attributes.volume_usd.h24 : null;
    stats.push({
      address: address.toLowerCase(),
      priceUsd: readUsd(row.attributes.price_usd, false),
      volumeUsd24h: readUsd(volume, true),
    });
  }
  return stats;
}

/** 24h USD volume and price for ETH and HOOD. The RHJ feed does not list them. */
export async function fetchListedChainStats(): Promise<ChainTokenStat[]> {
  const addresses = LOCAL_CHAIN_STOCKS.map((asset) => asset.contractAddress).join(",");
  const url = `https://api.geckoterminal.com/api/v2/networks/${GECKO_NETWORK}/tokens/multi/${addresses}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 30 },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[stocks] geckoterminal token stats failed", {
      status: res.status,
      body: body.slice(0, 200),
    });
    throw new Error(`GeckoTerminal token stats failed (${res.status})`);
  }
  const byAddress = new Map(
    parseGeckoTokenStats(await res.json()).map((stat) => [stat.address, stat]),
  );
  return LOCAL_CHAIN_STOCKS.map((asset) => {
    const stat = byAddress.get(asset.contractAddress.toLowerCase());
    if (!stat) {
      console.info("[stocks] geckoterminal token missing", { symbol: asset.symbol });
    }
    return {
      symbol: asset.symbol,
      priceUsd: stat?.priceUsd ?? null,
      volumeUsd24h: stat?.volumeUsd24h ?? null,
    };
  });
}

function readUsd(value: unknown, allowZero: boolean): number | null {
  const n =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(n) || n < 0) return null;
  if (!allowZero && n === 0) return null;
  return n;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
