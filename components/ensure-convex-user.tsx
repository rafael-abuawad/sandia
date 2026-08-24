"use client";

import { useEffect, useRef } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useAccount } from "wagmi";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

function privyEmail(user: ReturnType<typeof usePrivy>["user"]): string | undefined {
  if (!user) return undefined;
  return user.email?.address ?? user.google?.email ?? undefined;
}

/** Upserts the Convex user row once Privy auth and a wallet address are ready. */
export function EnsureConvexUser() {
  const { ready, authenticated, user } = usePrivy();
  const { address } = useAccount();
  const storeUser = useMutation(api.users.store);
  const lastKey = useRef<string | null>(null);

  const email = privyEmail(user);

  useEffect(() => {
    if (!ready || !authenticated || !address) return;
    const key = `${address.toLowerCase()}:${email ?? ""}`;
    if (lastKey.current === key) return;
    lastKey.current = key;

    const payload = email ? { address, email } : { address };
    void storeUser(payload).catch((error: unknown) => {
      lastKey.current = null;
      console.error("Failed to store Convex user", error);
    });
  }, [ready, authenticated, address, email, storeUser]);

  return null;
}
