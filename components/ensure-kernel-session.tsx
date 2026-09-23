"use client";

import { useEffect, useRef } from "react";
import { useAction, useQuery } from "convex/react";
import { useAccount, useSignMessage } from "wagmi";
import { api } from "@/convex/_generated/api";
import { kernelAuthSubject, sandiaLinkMessage } from "@/convex/lib/kernelSubject";
import {
  clearStoredKernelToken,
  readStoredKernelToken,
  useSandiaSession,
  writeStoredKernelToken,
} from "@/lib/sandia-session";

type LinkProof = {
  address: string;
  nonce: string;
  signature: string;
};

const inflight = new Map<string, Promise<LinkProof & { token: string }>>();

async function readJson(response: Response): Promise<{ error?: string; nonce?: string; token?: string }> {
  return (await response.json()) as { error?: string; nonce?: string; token?: string };
}

function mintKernelToken(
  address: string,
  sign: (message: string) => Promise<string>,
): Promise<LinkProof & { token: string }> {
  const key = address.toLowerCase();
  const existing = inflight.get(key);
  if (existing) return existing;

  const job = (async () => {
    const nonceResponse = await fetch("/api/auth/sandia/nonce", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ smartAccountAddress: address }),
    });
    const nonceBody = await readJson(nonceResponse);
    if (!nonceResponse.ok || !nonceBody.nonce) {
      throw new Error(nonceBody.error ?? "Could not start Sandia sign-in");
    }

    const signature = await sign(sandiaLinkMessage(nonceBody.nonce));
    const subject = kernelAuthSubject(address);
    const tokenResponse = await fetch("/api/auth/sandia/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        authSubject: subject,
        smartAccountAddress: address,
        nonce: nonceBody.nonce,
        signature,
      }),
    });
    const tokenBody = await readJson(tokenResponse);
    if (!tokenResponse.ok || !tokenBody.token) {
      throw new Error(tokenBody.error ?? "Could not sign in");
    }
    writeStoredKernelToken(subject, tokenBody.token);
    return {
      address: key,
      nonce: nonceBody.nonce,
      signature,
      token: tokenBody.token,
    };
  })().finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, job);
  return job;
}

export function EnsureKernelSession() {
  const { address, isConnected, connector } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const ensureKernel = useAction(api.identity.ensureKernel);
  const {
    token,
    paused,
    attempt,
    setToken,
    setLinking,
    setLinked,
    setLinkError,
    clear,
    resume,
  } = useSandiaSession();
  const me = useQuery(api.users.me, token ? {} : "skip");
  const proof = useRef<LinkProof | null>(null);
  const ensuredKey = useRef<string | null>(null);
  const wasConnected = useRef(false);

  const kernelConnected =
    Boolean(isConnected && address) &&
    (connector?.id ?? "").toLowerCase().includes("zero");

  useEffect(() => {
    if (kernelConnected) {
      wasConnected.current = true;
      return;
    }
    if (wasConnected.current && !isConnected) {
      wasConnected.current = false;
      proof.current = null;
      ensuredKey.current = null;
      clear();
    }
  }, [kernelConnected, isConnected, clear]);

  useEffect(() => {
    if (!isConnected && paused) resume();
  }, [isConnected, paused, resume]);

  useEffect(() => {
    if (paused || !kernelConnected || !address) return;
    const subject = kernelAuthSubject(address);
    const stored = readStoredKernelToken(subject);
    if (stored) {
      if (token !== stored) setToken(stored);
      return;
    }
    if (token) return;

    let alive = true;
    setLinking(true);
    setLinkError(null);
    void mintKernelToken(address, (message) => signMessageAsync({ message }))
      .then((result) => {
        if (!alive) return;
        proof.current = {
          address: result.address,
          nonce: result.nonce,
          signature: result.signature,
        };
        setToken(result.token);
        setLinkError(null);
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Could not sign in";
        console.error("kernel_session_failed", { address, message });
        if (!alive) return;
        setLinkError(message);
      })
      .finally(() => {
        if (alive) setLinking(false);
      });

    return () => {
      alive = false;
    };
  }, [
    paused,
    kernelConnected,
    address,
    token,
    attempt,
    signMessageAsync,
    setToken,
    setLinking,
    setLinkError,
  ]);

  useEffect(() => {
    if (!kernelConnected || !address || !token || me === undefined) return;
    const expected = address.toLowerCase();
    const current = (me?.smartAccountAddress ?? me?.address)?.toLowerCase();
    if (me && current === expected) {
      setLinked(true);
      setLinking(false);
      return;
    }
    if (me !== null) return;

    const currentProof = proof.current;
    if (!currentProof || currentProof.address !== expected) {
      clearStoredKernelToken();
      setToken(null);
      return;
    }

    const key = `${expected}:${currentProof.nonce}`;
    if (ensuredKey.current === key) return;
    ensuredKey.current = key;
    let alive = true;
    setLinking(true);
    void ensureKernel({
      smartAccountAddress: expected,
      nonce: currentProof.nonce,
      signature: currentProof.signature,
    })
      .then(() => {
        if (!alive) return;
        setLinkError(null);
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Could not link this Kernel";
        console.error("kernel_ensure_failed", { address: expected, message });
        ensuredKey.current = null;
        if (!alive) return;
        setLinkError(message);
      })
      .finally(() => {
        if (alive) setLinking(false);
      });

    return () => {
      alive = false;
    };
  }, [
    kernelConnected,
    address,
    token,
    me,
    ensureKernel,
    setLinked,
    setLinking,
    setToken,
    setLinkError,
  ]);

  return null;
}
