"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useMutation as useTanstackMutation } from "@tanstack/react-query";
import { useAccount, useSignMessage } from "wagmi";
import { createSiweMessage } from "viem/siwe";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { LEGACY_SESSION_STORAGE_KEY } from "@/lib/auth/session-cookie";

type AuthContextValue = {
  token: string | null;
  address: string | null;
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  error: string | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function persistSessionCookie(token: string, expiresAt: number) {
  const res = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, expiresAt }),
  });
  if (!res.ok) {
    throw new Error("Failed to persist session cookie");
  }
}

async function clearSessionCookie() {
  const res = await fetch("/api/auth/session", { method: "DELETE" });
  if (!res.ok) {
    throw new Error("Failed to clear session cookie");
  }
}

type AuthProviderProps = {
  children: React.ReactNode;
  /** HttpOnly cookie value read on the server — avoids client fetch-on-mount. */
  initialSessionToken?: string | null;
};

export function AuthProvider({ children, initialSessionToken = null }: AuthProviderProps) {
  const { address, chainId, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const getNonce = useMutation(api.auth.getNonce);
  const verifyAndCreateSession = useAction(api.authActions.verifyAndCreateSession);
  const signOutMutation = useMutation(api.auth.signOut);
  const clearCookie = useTanstackMutation({
    mutationFn: clearSessionCookie,
  });

  const [token, setToken] = useState<string | null>(initialSessionToken);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_SESSION_STORAGE_KEY);
    } catch {
      // ignore storage access errors
    }
  }, []);

  const me = useQuery(api.auth.me, token ? { sessionToken: token } : "skip");

  // Single invalidation path: Convex says session is dead, or wallet switched.
  useEffect(() => {
    if (!token) return;
    const sessionGone = me === null;
    const walletMismatch = Boolean(me && address && me.address !== address.toLowerCase());
    if (!sessionGone && !walletMismatch) return;
    clearCookie.mutate(undefined, {
      onSettled: () => setToken(null),
    });
  }, [token, me, address, clearCookie]);

  const signIn = useCallback(async () => {
    if (!address || !isConnected) {
      setError("Connect a wallet first");
      throw new Error("Connect a wallet first");
    }
    setIsAuthenticating(true);
    setError(null);
    try {
      const { nonce } = await getNonce({ address });
      const message = createSiweMessage({
        address,
        chainId: chainId ?? 1,
        domain: window.location.host,
        nonce,
        uri: window.location.origin,
        version: "1",
        statement: "Sign in to Payrequest to prove wallet ownership.",
      });
      const signature = await signMessageAsync({ message });
      const session = await verifyAndCreateSession({ message, signature });
      await persistSessionCookie(session.token, session.expiresAt);
      setToken(session.token);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sign-in failed";
      setError(msg);
      throw e;
    } finally {
      setIsAuthenticating(false);
    }
  }, [address, isConnected, chainId, getNonce, signMessageAsync, verifyAndCreateSession]);

  const signOut = useCallback(async () => {
    if (token) {
      try {
        await signOutMutation({ sessionToken: token });
      } catch {
        // ignore network/session errors on sign-out
      }
    }
    try {
      await clearSessionCookie();
    } catch {
      // best-effort cookie clear
    }
    setToken(null);
    setError(null);
  }, [token, signOutMutation]);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      address: me?.address ?? null,
      isAuthenticated: Boolean(token && me),
      isAuthenticating,
      signIn,
      signOut,
      error,
    }),
    [token, me, isAuthenticating, signIn, signOut, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
