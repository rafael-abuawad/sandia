import { paginationOptsValidator } from "convex/server";
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

const emptyPage = {
  page: [],
  isDone: true,
  continueCursor: "",
  splitCursor: null,
  pageStatus: null,
};

/** One page of payment requests for the activity feed, newest first. */
export const listMine = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.object({
    page: v.array(itemValidator),
    isDone: v.boolean(),
    continueCursor: v.string(),
    splitCursor: v.optional(v.union(v.string(), v.null())),
    pageStatus: v.optional(v.union(v.string(), v.null())),
  }),
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrNull(ctx);
    if (!user) return emptyPage;

    const result = await ctx.db
      .query("paymentRequests")
      .withIndex("by_creator", (q) => q.eq("creatorId", user._id))
      .order("desc")
      .paginate(args.paginationOpts);

    console.log("Listed activity page", {
      userId: user._id,
      count: result.page.length,
      isDone: result.isDone,
    });

    return {
      ...result,
      page: result.page.map((row) => ({
        id: row._id,
        publicId: row.publicId,
        amountUsdMicros: row.amountUsdMicros,
        description: row.description,
        status: row.status,
        createdAt: row.createdAt,
      })),
    };
  },
});
