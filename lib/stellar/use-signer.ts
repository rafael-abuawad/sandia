"use client";

import { useCallback } from "react";
import { useSignRawHash } from "@privy-io/react-auth/extended-chains";

/** Signs a 32-byte hash with the embedded Stellar wallet. Returns the Ed25519 signature as hex. */
export function useStellarSigner(address: string | undefined) {
  const { signRawHash } = useSignRawHash();
  return useCallback(
    async (hashHex: string): Promise<string> => {
      if (!address) throw new Error("Sign in to continue.");
      const hash = (hashHex.startsWith("0x") ? hashHex : `0x${hashHex}`) as `0x${string}`;
      const { signature } = await signRawHash({ address, chainType: "stellar", hash });
      return signature;
    },
    [address, signRawHash],
  );
}
