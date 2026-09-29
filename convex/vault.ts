import { action } from "./_generated/server";
import { v } from "convex/values";
import {
  MORPHO_GRAPHQL_URL,
  STEAKHOUSE_VAULT_QUERY,
  parseMorphoVaultSnapshot,
} from "../lib/morpho-vault";

const exposureValidator = v.object({
  symbol: v.string(),
  usd: v.number(),
  logoUrl: v.union(v.string(), v.null()),
});

const snapshotReturns = v.object({
  ok: v.boolean(),
  netApy: v.union(v.number(), v.null()),
  totalAssetsUsd: v.union(v.number(), v.null()),
  liquidityUsd: v.union(v.number(), v.null()),
  exposure: v.array(exposureValidator),
  reason: v.optional(v.string()),
});

function failedSnapshot(reason: string) {
  return {
    ok: false as const,
    netApy: null,
    totalAssetsUsd: null,
    liquidityUsd: null,
    exposure: [] as { symbol: string; usd: number; logoUrl: string | null }[],
    reason,
  };
}

export const readSnapshot = action({
  args: {},
  returns: snapshotReturns,
  handler: async () => {
    try {
      const response = await fetch(MORPHO_GRAPHQL_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({ query: STEAKHOUSE_VAULT_QUERY }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) {
        const reason = `Morpho returned ${response.status}`;
        console.error("vault_snapshot_failed", { status: response.status, reason });
        return failedSnapshot(reason);
      }
      const payload: unknown = await response.json();
      const parsed = parseMorphoVaultSnapshot(payload);
      if (!parsed.ok) {
        console.error("vault_snapshot_failed", { reason: parsed.reason });
        return failedSnapshot(parsed.reason);
      }
      console.info("vault_snapshot_ok", {
        netApy: parsed.snapshot.netApy,
        totalAssetsUsd: parsed.snapshot.totalAssetsUsd,
        exposure: parsed.snapshot.exposure.length,
      });
      return { ok: true as const, ...parsed.snapshot };
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Vault snapshot failed";
      console.error("vault_snapshot_failed", { reason });
      return failedSnapshot(reason);
    }
  },
});
