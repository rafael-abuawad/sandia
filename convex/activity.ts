import { query } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUserOrNull } from "./lib/auth";

const itemValidator = v.object({
  id: v.string(),
  kind: v.union(v.literal("request"), v.literal("send")),
  title: v.string(),
  status: v.string(),
  createdAt: v.number(),
});

export const listMine = query({
  args: {},
  returns: v.array(itemValidator),
  handler: async (ctx) => {
    const user = await getCurrentUserOrNull(ctx);
    if (!user) return [];

    const [requests, sends] = await Promise.all([
      ctx.db
        .query("paymentRequests")
        .withIndex("by_creator", (q) => q.eq("creatorId", user._id))
        .order("desc")
        .take(20),
      ctx.db
        .query("sends")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .order("desc")
        .take(20),
    ]);

    const items = [
      ...requests.map((row) => ({
        id: row._id,
        kind: "request" as const,
        title: `Request ${row.publicId}`,
        status: row.status,
        createdAt: row.createdAt,
      })),
      ...sends.map((row) => ({
        id: row._id,
        kind: "send" as const,
        title: "USDC send",
        status: row.status,
        createdAt: row.createdAt,
      })),
    ];
    items.sort((a, b) => b.createdAt - a.createdAt);
    return items.slice(0, 40);
  },
});
