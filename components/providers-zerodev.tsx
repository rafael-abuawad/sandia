"use client";

import { createConfig, http, useAccount, useDisconnect, WagmiProvider } from "wagmi";
import { zeroDevWallet } from "@zerodev/wallet-react";
import { EnsureKernelSession } from "@/components/ensure-kernel-session";
import { robinhoodChain } from "@/lib/chains";
import { AuthBridgeProvider } from "@/lib/auth-bridge";
import { passkeyRpId } from "@/lib/sandia-auth";
import { useSandiaSession } from "@/lib/sandia-session";

const zeroDevProjectId = process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID;

const kernelConfig = createConfig({
  chains: [robinhoodChain],
  connectors: zeroDevProjectId
    ? [
        zeroDevWallet({
          projectId: zeroDevProjectId,
          chains: [robinhoodChain],
          mode: "4337",
          rpId: passkeyRpId(),
        }),
      ]
    : [],
  transports: {
    [robinhoodChain.id]: http(robinhoodChain.rpcUrls.default.http[0]),
  },
  ssr: true,
  multiInjectedProviderDiscovery: false,
});

function KernelBridge({ children }: { children: React.ReactNode }) {
  const { isConnected } = useAccount();
  const { disconnectAsync } = useDisconnect();
  const session = useSandiaSession();

  async function logout() {
    session.pause();
    session.clear();
    try {
      await disconnectAsync();
    } catch (error) {
      console.error("kernel_logout_failed", {
        message: error instanceof Error ? error.message : "Could not disconnect",
      });
      session.resume();
    }
  }

  return (
    <AuthBridgeProvider
      value={{
        ready: !session.linking,
        authenticated: isConnected && session.linked,
        login: () => undefined,
        logout,
      }}
    >
      <EnsureKernelSession />
      {children}
    </AuthBridgeProvider>
  );
}

export function ZerodevProviders({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={kernelConfig}>
      <KernelBridge>{children}</KernelBridge>
    </WagmiProvider>
  );
}
