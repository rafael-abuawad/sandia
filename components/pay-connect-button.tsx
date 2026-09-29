"use client";

import { useEffect, useState } from "react";
import { useConnectWallet, useWallets } from "@privy-io/react-auth";
import { useSetActiveWallet } from "@privy-io/wagmi";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { shortenAddress } from "@/lib/utils";

export function PayConnectButton() {
  const { address, isConnected } = useAccount();
  const { wallets } = useWallets();
  const { setActiveWallet } = useSetActiveWallet();
  const [pendingAddress, setPendingAddress] = useState<string | null>(null);
  const { connectWallet } = useConnectWallet({
    onSuccess: ({ wallet }) => {
      if (wallet.type !== "ethereum") return;
      setPendingAddress(wallet.address);
    },
    onError: (error) => {
      console.error("payer_wallet_connect_failed", { message: String(error) });
    },
  });

  useEffect(() => {
    if (!pendingAddress) return;
    const match = wallets.find(
      (wallet) => wallet.address.toLowerCase() === pendingAddress.toLowerCase(),
    );
    if (!match) return;
    setPendingAddress(null);
    void setActiveWallet(match)
      .then(() => {
        console.log("payer_wallet_activated", { address: match.address });
      })
      .catch((error: unknown) => {
        console.error("payer_wallet_activate_failed", {
          address: match.address,
          message: error instanceof Error ? error.message : "Could not activate payer wallet",
        });
      });
  }, [pendingAddress, wallets, setActiveWallet]);

  const connected = Boolean(isConnected && address);

  return (
    <Button
      type="button"
      size="sm"
      variant={connected ? "secondary" : "default"}
      onClick={() => connectWallet()}
    >
      {connected && address ? shortenAddress(address, 4) : "Connect wallet"}
    </Button>
  );
}
