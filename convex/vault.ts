"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { createPublicClient, http, parseAbi, type Address } from "viem";

const VAULT = "0xBeEff033F34C046626B8D0A041844C5d1A5409dd";
const USDG = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168";

const abi = parseAbi([
  "function asset() view returns (address)",
  "function totalAssets() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function maxDeposit(address) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function convertToAssets(uint256) view returns (uint256)",
]);

const robinhood = {
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mainnet.chain.robinhood.com"] } },
} as const;

export const readPosition = action({
  args: { account: v.optional(v.string()) },
  returns: v.object({
    ok: v.boolean(),
    asset: v.optional(v.string()),
    assetIsUsdg: v.boolean(),
    totalAssets: v.optional(v.string()),
    totalSupply: v.optional(v.string()),
    maxDeposit: v.optional(v.string()),
    shares: v.optional(v.string()),
    assets: v.optional(v.string()),
    reason: v.optional(v.string()),
  }),
  handler: async (_ctx, args) => {
    const client = createPublicClient({
      chain: robinhood,
      transport: http(robinhood.rpcUrls.default.http[0]),
    });
    try {
      const asset = await client.readContract({
        address: VAULT,
        abi,
        functionName: "asset",
      });
      const assetIsUsdg = asset.toLowerCase() === USDG;
      const [totalAssets, totalSupply, maxDeposit] = await Promise.all([
        client.readContract({ address: VAULT, abi, functionName: "totalAssets" }),
        client.readContract({ address: VAULT, abi, functionName: "totalSupply" }),
        client.readContract({
          address: VAULT,
          abi,
          functionName: "maxDeposit",
          args: [(args.account ?? "0x0000000000000000000000000000000000000001") as Address],
        }),
      ]);
      let shares: bigint | undefined;
      let assets: bigint | undefined;
      if (args.account) {
        shares = await client.readContract({
          address: VAULT,
          abi,
          functionName: "balanceOf",
          args: [args.account as Address],
        });
        assets = await client.readContract({
          address: VAULT,
          abi,
          functionName: "convertToAssets",
          args: [shares],
        });
      }
      return {
        ok: assetIsUsdg,
        asset,
        assetIsUsdg,
        totalAssets: totalAssets.toString(),
        totalSupply: totalSupply.toString(),
        maxDeposit: maxDeposit.toString(),
        shares: shares?.toString(),
        assets: assets?.toString(),
        reason: assetIsUsdg ? undefined : "Vault asset is not USDG",
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Vault read failed";
      console.error("vault_read_failed", { reason });
      return { ok: false, assetIsUsdg: false, reason };
    }
  },
});
