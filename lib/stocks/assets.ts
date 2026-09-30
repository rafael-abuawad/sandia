import { getAddress } from "viem";
import { resolveChainIcon, resolveTokenIcon } from "@/lib/asset-icons";
import { ROBINHOOD_USDG, ROBINHOOD_WETH } from "@/lib/destination";
import type { StockToken } from "@/lib/rhj/client";

/**
 * Wrapped ETH on Robinhood Chain. The stock screen labels it ETH.
 * A buy delivers this token and does not wrap or unwrap native ETH.
 */
export const ETH_STOCK: StockToken = {
  id: "robinhood-eth",
  symbol: "ETH",
  name: "Ether",
  shortName: "Ether",
  contractAddress: getAddress(ROBINHOOD_WETH),
  chainId: ROBINHOOD_USDG.chainId,
  logoUrl: resolveTokenIcon("ETH"),
  currentMultiplier: "1",
  status: "ASSET_STATUS_ACTIVE",
  tokenDecimals: 18,
};

/**
 * Robinhood Markets common stock on Robinhood Chain.
 * Other tokens that reuse the HOOD symbol are ignored.
 */
export const HOOD_STOCK: StockToken = {
  id: "robinhood-hood",
  symbol: "HOOD",
  name: "Robinhood Markets Inc. Class A Common Stock",
  shortName: "Robinhood Markets Inc. Class A Common Stock",
  contractAddress: getAddress("0x274c8c4665c0343730c78b184e560f902a8bf200"),
  chainId: ROBINHOOD_USDG.chainId,
  logoUrl: resolveChainIcon(ROBINHOOD_USDG.chainId),
  currentMultiplier: "1",
  status: "ASSET_STATUS_ACTIVE",
  tokenDecimals: 18,
};

/** Chain tokens the RHJ feed does not list. HOOD stays reachable by symbol and is not on the market list. */
export const LOCAL_CHAIN_STOCKS: readonly StockToken[] = [HOOD_STOCK, ETH_STOCK];

/** Shown above the RHJ catalog. */
export const LISTED_CHAIN_STOCKS: readonly StockToken[] = [ETH_STOCK];

export function localStockBySymbol(symbol: string): StockToken | null {
  const upper = symbol.trim().toUpperCase();
  return LOCAL_CHAIN_STOCKS.find((asset) => asset.symbol === upper) ?? null;
}

/**
 * ETH and HOOD resolve to the deployed Robinhood Chain tokens.
 * Every other symbol comes from the RHJ catalog.
 */
export function resolveStockAsset(
  symbol: string,
  rhjAssets: readonly StockToken[],
): StockToken | null {
  const local = localStockBySymbol(symbol);
  if (local) return local;
  const upper = symbol.trim().toUpperCase();
  return rhjAssets.find((asset) => asset.symbol.toUpperCase() === upper) ?? null;
}

/** RHJ assets trade in shares. ETH and HOOD trade in tokens. */
export function stockQuantityLabel(symbol: string): "shares" | "tokens" {
  return localStockBySymbol(symbol) ? "tokens" : "shares";
}
