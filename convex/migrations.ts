import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { isStellarRecipient } from "../lib/stellar/strkey";

const BATCH = 200;

/**
 * Clean-cutover cleanup. Deletes pre-Stellar payment requests and contacts.
 * Not scheduled: run it by hand until `done` is true, after confirming no real funds are affected:
 *   npx convex run migrations:clearLegacyData
 * Tables removed from the schema (paymentAttempts, outboundTransfers, swapFills, vaultActivities)
 * stay untouched and unread. Clear those from the Convex dashboard.
 * Users keep their row: signing in again claims the new Stellar wallet.
 */
export const clearLegacyData = internalMutation({
  args: {},
  returns: v.object({
    deletedRequests: v.number(),
    deletedContacts: v.number(),
    done: v.boolean(),
  }),
  handler: async (ctx) => {
    const [requests, contacts] = await Promise.all([
      ctx.db.query("paymentRequests").take(BATCH),
      ctx.db.query("contacts").take(BATCH),
    ]);
    const legacyRequests = requests.filter((row) => !isStellarRecipient(row.recipientAddress));
    const legacyContacts = contacts.filter((row) => !isStellarRecipient(row.address));
    await Promise.all([
      ...legacyRequests.map((row) => ctx.db.delete(row._id)),
      ...legacyContacts.map((row) => ctx.db.delete(row._id)),
    ]);
    return {
      deletedRequests: legacyRequests.length,
      deletedContacts: legacyContacts.length,
      done: legacyRequests.length === 0 && legacyContacts.length === 0,
    };
  },
});
