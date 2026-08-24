import type { PrivyClientConfig } from "@privy-io/react-auth";
import { appChains } from "@/lib/chains";

export const privyConfig: PrivyClientConfig = {
  loginMethods: ["wallet", "email", "google"],
  appearance: {
    theme: "light",
    accentColor: "#9fe870",
    walletChainType: "ethereum-only",
  },
  embeddedWallets: {
    ethereum: {
      createOnLogin: "users-without-wallets",
    },
  },
  defaultChain: appChains[0],
  supportedChains: [...appChains],
};
