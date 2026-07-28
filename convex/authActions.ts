"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { parseSiweMessage, validateSiweMessage } from "viem/siwe";
import { verifyMessage, type Address, type Hex } from "viem";
import { internal } from "./_generated/api";

export const verifyAndCreateSession = action({
  args: {
    message: v.string(),
    signature: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    token: string;
    expiresAt: number;
    address: string;
    userId: string;
  }> => {
    const parsed = parseSiweMessage(args.message);
    if (!parsed.address || !parsed.nonce) {
      throw new Error("Invalid SIWE message");
    }

    const address = parsed.address as Address;
    const structureOk = validateSiweMessage({
      message: {
        ...parsed,
        address,
      },
      address,
      nonce: parsed.nonce,
    });
    if (!structureOk) {
      throw new Error("SIWE message validation failed");
    }

    const validSig = await verifyMessage({
      address,
      message: args.message,
      signature: args.signature as Hex,
    });
    if (!validSig) {
      throw new Error("Invalid SIWE signature");
    }

    const session = await ctx.runMutation(internal.auth.createSessionAfterSiwe, {
      address: address.toLowerCase(),
      nonce: parsed.nonce,
    });

    return {
      token: session.token as string,
      expiresAt: session.expiresAt as number,
      address: session.address as string,
      userId: String(session.userId),
    };
  },
});
