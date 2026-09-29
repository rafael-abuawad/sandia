"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  getEmbeddedConnectedWallet,
  useCreateWallet,
  usePrivy,
  useWallets,
} from "@privy-io/react-auth";
import { useSetActiveWallet } from "@privy-io/wagmi";
import { useAccount, useConnect } from "wagmi";
import { AuthBridgeProvider } from "@/lib/auth-bridge";
import { EnsureConvexUser } from "@/components/ensure-convex-user";
import { privyConnectorReady, walletSetupAction } from "@/lib/wallet-setup";

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

function EmbeddedWalletPin({
  attempt,
  onFailed,
}: {
  attempt: number;
  onFailed: (failed: boolean) => void;
}) {
  const { authenticated } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const { createWallet } = useCreateWallet();
  const { setActiveWallet } = useSetActiveWallet();
  const { address } = useAccount();
  const { connectors } = useConnect();
  const createAttempted = useRef(false);
  const activating = useRef(false);
  const attemptedKey = useRef<string | null>(null);
  const lastAttempt = useRef(attempt);
  if (lastAttempt.current !== attempt) {
    lastAttempt.current = attempt;
    createAttempted.current = false;
    attemptedKey.current = null;
    activating.current = false;
  }

  const embedded = getEmbeddedConnectedWallet(wallets);
  const embeddedAddress = embedded?.address;
  const connectorKey = connectors.map((connector) => connector.id).join("|");
  const connectorReady = embeddedAddress
    ? privyConnectorReady(connectorKey.split("|"), embeddedAddress)
    : false;
  const settled = Boolean(
    embeddedAddress && address && address.toLowerCase() === embeddedAddress.toLowerCase(),
  );

  useEffect(() => {
    if (!authenticated || settled) {
      onFailed(false);
      return;
    }
    const timer = window.setTimeout(() => onFailed(true), WALLET_SETUP_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [authenticated, settled, attempt, onFailed]);

  useEffect(() => {
    const action = walletSetupAction({
      authenticated,
      walletsReady,
      embeddedAddress,
      activeAddress: address,
      connectorReady,
      createAttempted: createAttempted.current,
    });

    if (action === "create") {
      createAttempted.current = true;
      void createWallet().catch((error: unknown) => {
        console.error("embedded_wallet_create_failed", {
          message: error instanceof Error ? error.message : "Could not create embedded wallet",
        });
      });
      return;
    }

    if (action !== "activate" || !embedded) return;

    const key = `${embedded.address.toLowerCase()}::${connectorKey}`;
    if (activating.current || attemptedKey.current === key) return;

    activating.current = true;
    attemptedKey.current = key;
    console.log("embedded_wallet_activate_requested", { address: embedded.address });
    void setActiveWallet(embedded)
      .catch((error: unknown) => {
        attemptedKey.current = null;
        console.error("embedded_wallet_activate_failed", {
          address: embedded.address,
          message: error instanceof Error ? error.message : "Could not activate embedded wallet",
        });
      })
      .finally(() => {
        activating.current = false;
      });
  }, [
    authenticated,
    walletsReady,
    wallets,
    embedded,
    embeddedAddress,
    address,
    connectorReady,
    connectorKey,
    setActiveWallet,
    createWallet,
    attempt,
  ]);

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
        <EmbeddedWalletPin attempt={attempt} onFailed={setFailed} />
        <EnsureConvexUser />
        {children}
      </WalletSetupContext.Provider>
    </AuthBridgeProvider>
  );
}

export function PrivyAppProviders({ children }: { children: React.ReactNode }) {
  return <PrivyBridge>{children}</PrivyBridge>;
}
