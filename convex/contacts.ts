import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUser } from "./lib/auth";
import { memoError } from "../lib/stellar/memo";
import { isStellarRecipient, normalizeRecipient } from "../lib/stellar/strkey";

function normalizeMemo(memo: string | undefined): string | undefined {
  const trimmed = memo?.trim();
  if (!trimmed) return undefined;
  const problem = memoError(trimmed);
  if (problem) throw new Error(problem);
  return trimmed;
}

const contactValidator = v.object({
  _id: v.id("contacts"),
  _creationTime: v.number(),
  userId: v.id("users"),
  name: v.string(),
  address: v.string(),
  memo: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const list = query({
  args: {},
  returns: v.array(contactValidator),
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    const contacts = await ctx.db
      .query("contacts")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(100);
    // Contacts saved before the Stellar cutover hold 0x addresses that can't receive USDC here.
    return contacts.filter((contact) => isStellarRecipient(contact.address));
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    address: v.string(),
    memo: v.optional(v.string()),
  },
  returns: v.id("contacts"),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const name = args.name.trim();
    if (name.length < 1) throw new Error("Enter a name");
    if (name.length > 80) throw new Error("Name must be 80 characters or fewer");
    const address = normalizeRecipient(args.address);

    const existing = await ctx.db
      .query("contacts")
      .withIndex("by_user_and_address", (q) => q.eq("userId", user._id).eq("address", address))
      .unique();
    if (existing) {
      throw new Error("This address is already in your address book");
    }

    const now = Date.now();
    const id = await ctx.db.insert("contacts", {
      userId: user._id,
      name,
      address,
      memo: normalizeMemo(args.memo),
      createdAt: now,
      updatedAt: now,
    });
    console.log("Created contact", { userId: user._id, contactId: id, address });
    return id;
  },
});

export const update = mutation({
  args: {
    contactId: v.id("contacts"),
    name: v.optional(v.string()),
    address: v.optional(v.string()),
    memo: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const contact = await ctx.db.get(args.contactId);
    if (!contact) throw new Error("Contact not found");
    if (contact.userId !== user._id) throw new Error("Unauthorized");

    const patch: { name?: string; address?: string; memo?: string; updatedAt: number } = {
      updatedAt: Date.now(),
    };
    if (args.name !== undefined) {
      const name = args.name.trim();
      if (name.length < 1) throw new Error("Enter a name");
      if (name.length > 80) throw new Error("Name must be 80 characters or fewer");
      patch.name = name;
    }
    if (args.address !== undefined) {
      const address = normalizeRecipient(args.address);
      if (address !== contact.address) {
        const existing = await ctx.db
          .query("contacts")
          .withIndex("by_user_and_address", (q) => q.eq("userId", user._id).eq("address", address))
          .unique();
        if (existing) throw new Error("This address is already in your address book");
      }
      patch.address = address;
    }

    if (args.memo !== undefined) patch.memo = normalizeMemo(args.memo);

    await ctx.db.patch(args.contactId, patch);
    console.log("Updated contact", { userId: user._id, contactId: args.contactId });
    return null;
  },
});

export const remove = mutation({
  args: { contactId: v.id("contacts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const contact = await ctx.db.get(args.contactId);
    if (!contact) throw new Error("Contact not found");
    if (contact.userId !== user._id) throw new Error("Unauthorized");
    await ctx.db.delete(args.contactId);
    console.log("Deleted contact", { userId: user._id, contactId: args.contactId });
    return null;
  },
});
