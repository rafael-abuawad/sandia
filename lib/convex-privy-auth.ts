"use client";

import { useCallback, useMemo, useRef } from "react";
import { usePrivy } from "@privy-io/react-auth";

/** ConvexProviderWithAuth adapter for Privy access tokens. */
export function useConvexPrivyAuth() {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const getAccessTokenRef = useRef(getAccessToken);
  getAccessTokenRef.current = getAccessToken;

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken: _forceRefreshToken }: { forceRefreshToken: boolean }) => {
      if (!authenticated) return null;
      try {
        return await getAccessTokenRef.current();
      } catch (error) {
        console.error("Failed to fetch Privy access token", error);
        return null;
      }
    },
    [authenticated],
  );

  return useMemo(
    () => ({
      isLoading: !ready,
      isAuthenticated: authenticated,
      fetchAccessToken,
    }),
    [ready, authenticated, fetchAccessToken],
  );
}
