"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchAccountState } from "./horizon";

export function stellarAccountKey(address: string | undefined) {
  return ["stellar-account", address] as const;
}

/** Live account state: whether it exists, its USDC trustline, and its balance. */
export function useStellarAccount(address: string | undefined) {
  return useQuery({
    queryKey: stellarAccountKey(address),
    queryFn: () => fetchAccountState(address as string),
    enabled: Boolean(address),
    refetchInterval: 30_000,
    retry: 1,
  });
}
