import { v } from "convex/values";
import { action } from "./_generated/server";
import { resolveIntentWithJev } from "../lib/jev-client";

const actionValidator = v.union(
  v.literal("send"),
  v.literal("batch_send"),
  v.literal("request"),
  v.literal("earn_deposit"),
  v.literal("earn_withdraw"),
  v.literal("stock_buy"),
  v.literal("stock_sell"),
  v.literal("unsupported"),
);
const probabilityValidator = v.record(v.string(), v.number());
const answerValidator = v.union(
  v.object({
    status: v.literal("resolved"),
    action: actionValidator,
    confidence: v.number(),
    probabilities: probabilityValidator,
  }),
  v.object({ status: v.literal("choose"), probabilities: probabilityValidator }),
  v.object({ status: v.literal("unsupported"), reason: v.string() }),
);

export const resolveIntent = action({
  args: { prompt: v.string() },
  returns: answerValidator,
  handler: async (ctx, { prompt }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Sign in to use AI Agent.");
    if (prompt.trim().length === 0 || prompt.length > 2_000) {
      throw new Error("Enter an intent between 1 and 2,000 characters.");
    }
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("AI Agent is not configured yet. Try again later.");
    return await resolveIntentWithJev(prompt, apiKey);
  },
});
