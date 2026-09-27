import type { PrivyClientConfig } from "@privy-io/react-auth";
import { appChains, robinhoodChain } from "@/lib/chains";

export const privyConfig: PrivyClientConfig = {
  loginMethods: ["email"],
  appearance: {
    theme: "light",
    accentColor: "#9fe870",
    walletChainType: "ethereum-only",
  },
  embeddedWallets: {
    ethereum: {
      createOnLogin: "all-users",
    },
  },
  defaultChain: robinhoodChain,
  supportedChains: [...appChains],
};
