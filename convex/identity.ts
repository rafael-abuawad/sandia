"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { createPublicClient, http, hashMessage, type Hex } from "viem";
import { assertClaimNonce } from "./lib/walletClaim";
import { isKernelAuthSubject, sandiaLinkMessage } from "./lib/kernelSubject";

const ERC1271_MAGIC = "0x1626ba7e";

const isValidSignatureAbi = [
  {
    type: "function",
    name: "isValidSignature",
    stateMutability: "view",
    inputs: [
      { name: "hash", type: "bytes32" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [{ name: "magicValue", type: "bytes4" }],
  },
] as const;

const robinhood = {
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mainnet.chain.robinhood.com"] } },
} as const;

export const ensureKernel = action({
  args: {
    smartAccountAddress: v.string(),
    signature: v.string(),
    nonce: v.string(),
    kernelVersion: v.optional(v.string()),
    entryPointVersion: v.optional(v.string()),
  },
  returns: v.object({
    userId: v.id("users"),
    smartAccountAddress: v.string(),
  }),
  handler: async (ctx, args): Promise<{ userId: Id<"users">; smartAccountAddress: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const address = args.smartAccountAddress.toLowerCase();
    if (!isKernelAuthSubject(identity.subject, address)) {
      throw new Error("Sign-in does not match this Kernel");
    }

    const secret = process.env.SANDIA_NONCE_SECRET;
    if (!secret) throw new Error("Wallet link is not configured");
    await assertClaimNonce(identity.subject, args.nonce, secret, Date.now());

    const client = createPublicClient({ chain: robinhood, transport: http() });
    let magic: string;
    try {
      magic = await client.readContract({
        address: address as Hex,
        abi: isValidSignatureAbi,
        functionName: "isValidSignature",
        args: [hashMessage(sandiaLinkMessage(args.nonce)), args.signature as Hex],
      });
    } catch (error) {
      console.error("kernel_signature_check_failed", {
        smartAccountAddress: address,
        message: error instanceof Error ? error.message : "Unknown error",
      });
      throw new Error("Smart account signature could not be checked");
    }
    if (magic.toLowerCase() !== ERC1271_MAGIC) {
      throw new Error("Smart account did not sign this link");
    }

    const userId: Id<"users"> = await ctx.runMutation(internal.identityQueries.upsertKernelUser, {
      authIssuer: identity.issuer,
      authSubject: identity.subject,
      smartAccountAddress: address,
      kernelVersion: args.kernelVersion,
      entryPointVersion: args.entryPointVersion,
    });
    console.log("kernel_account_ensured", { userId, smartAccountAddress: address });
    return { userId, smartAccountAddress: address };
  },
});
