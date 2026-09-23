"use client";

import { createConfig, http, WagmiProvider } from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";
import { ConnectKitButton, ConnectKitProvider } from "connectkit";
import { base } from "viem/chains";
import { appChains } from "@/lib/chains";
import { Button } from "@/components/ui/button";

const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const payConfig = createConfig({
  chains: appChains,
  connectors: [
    injected(),
    ...(walletConnectProjectId
      ? [
          walletConnect({
            projectId: walletConnectProjectId,
            showQrModal: false,
            metadata: {
              name: "Payrequest",
              description: "Pay a request from your wallet",
              url: appUrl,
              icons: [],
            },
          }),
        ]
      : []),
  ],
  transports: Object.fromEntries(appChains.map((chain) => [chain.id, http()])) as Record<
    (typeof appChains)[number]["id"],
    ReturnType<typeof http>
  >,
  ssr: true,
});

export function ConnectKitProviders({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={payConfig}>
      <ConnectKitProvider
        mode="light"
        customTheme={{
          "--ck-accent-color": "#9fe870",
          "--ck-accent-text-color": "#163300",
        }}
        options={{
          initialChainId: base.id,
          enforceSupportedChains: true,
          hideBalance: true,
        }}
      >
        {children}
      </ConnectKitProvider>
    </WagmiProvider>
  );
}

export function PayConnectButton() {
  return (
    <ConnectKitButton.Custom>
      {({ isConnected, show, truncatedAddress, ensName }) => (
        <Button type="button" size="sm" variant={isConnected ? "secondary" : "default"} onClick={show}>
          {isConnected ? (ensName ?? truncatedAddress ?? "Connected") : "Connect wallet"}
        </Button>
      )}
    </ConnectKitButton.Custom>
  );
}
