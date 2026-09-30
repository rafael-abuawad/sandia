"use client";

import { useEffect, useState } from "react";
import type { ChainTokenStat } from "@/lib/stocks/gecko";

/** GeckoTerminal price and 24h volume for ETH and HOOD. */
export function useChainTokenStats(enabled: boolean) {
  const [stats, setStats] = useState<Record<string, ChainTokenStat>>({});

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/stocks/chain-stats");
        if (!res.ok) {
          console.error("[stocks] chain stats failed", { status: res.status });
          return;
        }
        const body = (await res.json()) as { stats?: ChainTokenStat[] };
        if (cancelled) return;
        const next: Record<string, ChainTokenStat> = {};
        for (const stat of body.stats ?? []) next[stat.symbol] = stat;
        setStats(next);
      } catch (error) {
        console.error("[stocks] chain stats failed", error);
      }
    };
    void load();
    const id = window.setInterval(() => {
      void load();
    }, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled]);

  return stats;
}
