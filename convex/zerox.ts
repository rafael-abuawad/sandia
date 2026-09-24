"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

const ZEROX = "https://api.0x.org/swap/allowance-holder/price";

type ZeroXPriceBody = {
  liquidityAvailable?: boolean;
  buyAmount?: string;
  minBuyAmount?: string;
  name?: string;
  message?: string;
  code?: string;
};

export const probeQuote = action({
  args: {
    sellToken: v.string(),
    buyToken: v.string(),
    sellAmount: v.string(),
    taker: v.string(),
  },
  returns: v.object({
    ok: v.boolean(),
    status: v.number(),
    liquidityAvailable: v.optional(v.boolean()),
    buyAmount: v.optional(v.string()),
    minBuyAmount: v.optional(v.string()),
    reason: v.optional(v.string()),
  }),
  handler: async (_ctx, args) => {
    const key = process.env.ZEROX_API_KEY;
    if (!key) {
      console.error("zerox_quote_unauthorized", { reason: "ZEROX_API_KEY is not configured" });
      return {
        ok: false,
        status: 0,
        reason: "Stock trading is unavailable until a 0x API key is configured",
      };
    }
    const url = new URL(ZEROX);
    url.searchParams.set("chainId", "4663");
    url.searchParams.set("sellToken", args.sellToken);
    url.searchParams.set("buyToken", args.buyToken);
    url.searchParams.set("sellAmount", args.sellAmount);
    url.searchParams.set("taker", args.taker);
    const res = await fetch(url, {
      headers: {
        "0x-api-key": key,
        "0x-version": "v2",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      const errorBody = (await res.json().catch(() => ({}))) as ZeroXPriceBody;
      const reason =
        errorBody.name || errorBody.code || errorBody.message || `0x quote failed (${res.status})`;
      console.error("zerox_quote_unauthorized", { status: res.status, reason });
      return { ok: false, status: res.status, reason };
    }
    const body = (await res.json().catch(() => ({}))) as ZeroXPriceBody;
    if (body.liquidityAvailable !== true) {
      return {
        ok: false,
        status: res.status,
        liquidityAvailable: body.liquidityAvailable,
        reason: "0x has no executable liquidity for this stock token",
      };
    }
    return {
      ok: true,
      status: res.status,
      liquidityAvailable: true,
      buyAmount: body.buyAmount,
      minBuyAmount: body.minBuyAmount,
    };
  },
});
