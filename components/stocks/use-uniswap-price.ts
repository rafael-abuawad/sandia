"use client";

import { useEffect, useRef, useState } from "react";
import { getAddress } from "viem";
import { usePublicClient } from "wagmi";
import { ROBINHOOD_USDG } from "@/lib/destination";
import { quoteTokenUsdPrice } from "@/lib/stocks/uniswap";

type PricedAsset = {
  symbol: string;
  contractAddress: string;
  tokenDecimals: number;
};

/** Uniswap mid prices for assets the RHJ feed does not list. Pass a stable asset list. */
export function useUniswapDisplayPrices(assets: readonly PricedAsset[]) {
  const publicClient = usePublicClient({ chainId: ROBINHOOD_USDG.chainId });
  const [prices, setPrices] = useState<Record<string, number | null>>({});
  const assetsRef = useRef(assets);
  assetsRef.current = assets;
  const key = assets
    .map((asset) => `${asset.symbol}:${asset.contractAddress}:${asset.tokenDecimals}`)
    .join("|");

  useEffect(() => {
    const listed = assetsRef.current;
    if (!publicClient || listed.length === 0) return;
    let cancelled = false;
    const load = async () => {
      const entries = await Promise.all(
        listed.map(async (asset) => {
          try {
            const price = await quoteTokenUsdPrice(
              publicClient,
              getAddress(asset.contractAddress),
              asset.tokenDecimals,
            );
            return [asset.symbol, price] as const;
          } catch (error) {
            console.error("[stocks] display price failed", { symbol: asset.symbol, error });
            return [asset.symbol, null] as const;
          }
        }),
      );
      if (!cancelled) setPrices(Object.fromEntries(entries));
    };
    void load();
    const id = window.setInterval(() => {
      void load();
    }, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [publicClient, key]);

  return prices;
}
