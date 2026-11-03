import { query } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUserOrNull } from "./lib/auth";

const itemValidator = v.object({
  id: v.string(),
  publicId: v.string(),
  amountUsdMicros: v.number(),
  description: v.optional(v.string()),
  status: v.string(),
  createdAt: v.number(),
});

/** Payment requests for the activity feed. Trades and transfers come from Hyperliquid. */
export const listMine = query({
  args: {},
  returns: v.array(itemValidator),
  handler: async (ctx) => {
    const user = await getCurrentUserOrNull(ctx);
    if (!user) return [];
    const requests = await ctx.db
      .query("paymentRequests")
      .withIndex("by_creator", (q) => q.eq("creatorId", user._id))
      .order("desc")
      .take(30);
    return requests.map((row) => ({
      id: row._id,
      publicId: row.publicId,
      amountUsdMicros: row.amountUsdMicros,
      description: row.description,
      status: row.status,
      createdAt: row.createdAt,
    }));
  },
});
