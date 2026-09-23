"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { createPublicClient, http, hashMessage, type Hex } from "viem";
import { assertLinkTargets } from "./lib/walletClaim";

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

export const linkIdentity = action({
  args: {
    authSubject: v.string(),
    smartAccountAddress: v.string(),
    signature: v.string(),
    nonce: v.string(),
    kernelVersion: v.optional(v.string()),
    entryPointVersion: v.optional(v.string()),
  },
  returns: v.object({ smartAccountAddress: v.string() }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.issuer !== "privy.io") {
      throw new Error("Sign in with the existing account before linking a Sandia wallet");
    }
    if (args.authSubject.trim().length < 8) {
      throw new Error("Sandia sign-in subject is missing");
    }
    if (args.authSubject.toLowerCase() === args.smartAccountAddress.toLowerCase()) {
      throw new Error("Sign-in subject cannot be only the wallet address");
    }

    const message = `Sandia link\n${args.nonce}`;
    const client = createPublicClient({ chain: robinhood, transport: http() });
    const magic = await client.readContract({
      address: args.smartAccountAddress as Hex,
      abi: isValidSignatureAbi,
      functionName: "isValidSignature",
      args: [hashMessage(message), args.signature as Hex],
    });
    if (magic.toLowerCase() !== ERC1271_MAGIC) {
      throw new Error("Smart account did not sign this link");
    }

    const owners = await ctx.runQuery(internal.identityQueries.linkOwners, {
      authSubject: args.authSubject,
      smartAccountAddress: args.smartAccountAddress.toLowerCase(),
    });
    const current = await ctx.runQuery(internal.identityQueries.currentPrivyUser, {});
    if (!current) throw new Error("User not found");
    assertLinkTargets({
      currentUserId: current.userId,
      subjectOwnerId: owners.subjectOwnerId ?? undefined,
      accountOwnerId: owners.accountOwnerId ?? undefined,
    });

    await ctx.runMutation(internal.identityQueries.applyLink, {
      userId: current.userId,
      authSubject: args.authSubject,
      smartAccountAddress: args.smartAccountAddress.toLowerCase(),
      kernelVersion: args.kernelVersion,
      entryPointVersion: args.entryPointVersion,
    });
    console.log("identity_linked", {
      userId: current.userId,
      smartAccountAddress: args.smartAccountAddress.toLowerCase(),
    });
    return { smartAccountAddress: args.smartAccountAddress.toLowerCase() };
  },
});
