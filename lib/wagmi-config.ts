import { createConfig } from "@privy-io/wagmi";
import { http } from "wagmi";
import { appChains } from "@/lib/chains";

export const wagmiConfig = createConfig({
  chains: appChains,
  transports: Object.fromEntries(appChains.map((chain) => [chain.id, http()])) as Record<
    (typeof appChains)[number]["id"],
    ReturnType<typeof http>
  >,
});
