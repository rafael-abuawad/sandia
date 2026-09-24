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
        console.error("privy_access_token_failed", {
          message: error instanceof Error ? error.message : "Could not fetch Privy token",
        });
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
