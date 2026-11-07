import type { PrivyClientConfig } from "@privy-io/react-auth";

/** Sandia accounts sign in with email. Their Stellar wallet is created through extended chains. */
export const privyConfig: PrivyClientConfig = {
  loginMethods: ["email"],
  appearance: {
    theme: "light",
    accentColor: "#9fe870",
  },
  embeddedWallets: {
    ethereum: {
      createOnLogin: "off",
    },
  },
};
