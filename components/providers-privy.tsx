"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useCreateWallet } from "@privy-io/react-auth/extended-chains";
import { AuthBridgeProvider } from "@/lib/auth-bridge";
import { EnsureConvexUser } from "@/components/ensure-convex-user";
import { stellarWalletAddress, walletSetupAction } from "@/lib/wallet-setup";

const WALLET_SETUP_TIMEOUT_MS = 12_000;

type WalletSetupState = {
  failed: boolean;
  retry: () => void;
};

const WalletSetupContext = createContext<WalletSetupState>({
  failed: false,
  retry: () => {},
});

export function useWalletSetup() {
  return useContext(WalletSetupContext);
}

function EmbeddedWalletSetup({
  attempt,
  onFailed,
}: {
  attempt: number;
  onFailed: (failed: boolean) => void;
}) {
  const { ready, authenticated, user } = usePrivy();
  const { createWallet } = useCreateWallet();
  const createAttempted = useRef(false);
  const lastAttempt = useRef(attempt);
  if (lastAttempt.current !== attempt) {
    lastAttempt.current = attempt;
    createAttempted.current = false;
  }

  const stellarAddress = stellarWalletAddress(user?.linkedAccounts);

  useEffect(() => {
    if (!authenticated || stellarAddress) return;
    const timer = window.setTimeout(() => onFailed(true), WALLET_SETUP_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [authenticated, stellarAddress, attempt, onFailed]);

  useEffect(() => {
    const action = walletSetupAction({
      authenticated,
      ready,
      stellarAddress,
      createAttempted: createAttempted.current,
    });
    if (action !== "create") return;
    createAttempted.current = true;
    void createWallet({ chainType: "stellar" }).catch((error: unknown) => {
      onFailed(true);
      console.error("embedded_wallet_create_failed", {
        message: error instanceof Error ? error.message : "Could not create embedded wallet",
      });
    });
  }, [authenticated, ready, stellarAddress, createWallet, attempt, onFailed]);

  return null;
}

function PrivyBridge({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setFailed(false);
    setAttempt((current) => current + 1);
  }, []);

  return (
    <AuthBridgeProvider
      value={{
        ready,
        authenticated,
        login,
        logout,
        email: user?.email?.address,
      }}
    >
      <WalletSetupContext.Provider value={{ failed, retry }}>
        <EmbeddedWalletSetup attempt={attempt} onFailed={setFailed} />
        <EnsureConvexUser attempt={attempt} onFailed={setFailed} />
        {children}
      </WalletSetupContext.Provider>
    </AuthBridgeProvider>
  );
}

export function PrivyAppProviders({ children }: { children: React.ReactNode }) {
  return <PrivyBridge>{children}</PrivyBridge>;
}
