import { query } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUserOrNull } from "./lib/auth";

const userValidator = v.object({
  _id: v.id("users"),
  _creationTime: v.number(),
  privyDid: v.optional(v.string()),
  address: v.string(),
  email: v.optional(v.string()),
  authIssuer: v.optional(v.string()),
  authSubject: v.optional(v.string()),
  smartAccountAddress: v.optional(v.string()),
  kernelVersion: v.optional(v.string()),
  entryPointVersion: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const me = query({
  args: {},
  returns: v.union(userValidator, v.null()),
  handler: async (ctx) => {
    return await getCurrentUserOrNull(ctx);
  },
});
