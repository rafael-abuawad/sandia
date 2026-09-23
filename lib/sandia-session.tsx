"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

const STORAGE_KEY = "sandia.kernel.jwt";

type StoredJwt = {
  token: string;
  subject: string;
  expMs: number;
};

type SandiaSessionValue = {
  token: string | null;
  linking: boolean;
  linked: boolean;
  paused: boolean;
  linkError: string | null;
  attempt: number;
  setToken: (token: string | null) => void;
  setLinking: (linking: boolean) => void;
  setLinked: (linked: boolean) => void;
  setLinkError: (error: string | null) => void;
  pause: () => void;
  resume: () => void;
  clear: () => void;
  retry: () => void;
};

const SandiaSessionContext = createContext<SandiaSessionValue | null>(null);

function decodeExpMs(token: string): number | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const json = JSON.parse(
      atob(part.replace(/-/g, "+").replace(/_/g, "/")),
    ) as { exp?: number };
    return typeof json.exp === "number" ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function readStoredKernelToken(subject: string): string | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredJwt;
    if (parsed.subject !== subject) return null;
    if (parsed.expMs < Date.now() + 60_000) return null;
    return parsed.token;
  } catch {
    return null;
  }
}

export function writeStoredKernelToken(subject: string, token: string): void {
  const expMs = decodeExpMs(token);
  if (!expMs) return;
  const stored: StoredJwt = { token, subject, expMs };
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

export function clearStoredKernelToken(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(STORAGE_KEY);
}

export function SandiaSessionProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [linked, setLinked] = useState(false);
  const [paused, setPaused] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const clear = useCallback(() => {
    clearStoredKernelToken();
    setToken(null);
    setLinked(false);
    setLinking(false);
    setLinkError(null);
  }, []);

  const retry = useCallback(() => {
    clearStoredKernelToken();
    setToken(null);
    setLinked(false);
    setLinking(false);
    setLinkError(null);
    setAttempt((current) => current + 1);
  }, []);

  const pause = useCallback(() => setPaused(true), []);
  const resume = useCallback(() => setPaused(false), []);

  const value = useMemo<SandiaSessionValue>(
    () => ({
      token,
      linking,
      linked,
      paused,
      linkError,
      attempt,
      setToken,
      setLinking,
      setLinked,
      setLinkError,
      pause,
      resume,
      clear,
      retry,
    }),
    [token, linking, linked, paused, linkError, attempt, pause, resume, clear, retry],
  );

  return (
    <SandiaSessionContext.Provider value={value}>{children}</SandiaSessionContext.Provider>
  );
}

export function useSandiaSession(): SandiaSessionValue {
  const value = useContext(SandiaSessionContext);
  if (!value) throw new Error("Sandia session is missing");
  return value;
}
