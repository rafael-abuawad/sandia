import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

const WINDOW_MS = 60 * 60 * 1000;
/** Enough for real use, low enough that a leaked session can't burn the sponsor's XLM. */
const MAX_PER_HOUR = 60;

export const consume = internalMutation({
  args: { userId: v.id("users") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const windowStart = Math.floor(Date.now() / WINDOW_MS) * WINDOW_MS;
    const row = await ctx.db
      .query("sponsorUsage")
      .withIndex("by_user_and_window", (q) =>
        q.eq("userId", args.userId).eq("windowStart", windowStart),
      )
      .unique();
    if (!row) {
      await ctx.db.insert("sponsorUsage", { userId: args.userId, windowStart, count: 1 });
      return true;
    }
    if (row.count >= MAX_PER_HOUR) return false;
    await ctx.db.patch(row._id, { count: row.count + 1 });
    return true;
  },
});
