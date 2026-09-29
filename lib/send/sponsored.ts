import type { Address, Hex } from "viem";
import { ROBINHOOD_USDG } from "@/lib/destination";

/** A Privy embedded-wallet call paid for by the app on Robinhood Chain. */
export function sponsoredSendRequest(
  call: { to: Address; data: Hex; value: bigint },
  walletAddress: Address | string,
) {
  return {
    transaction: {
      to: call.to,
      data: call.data,
      value: call.value,
      chainId: ROBINHOOD_USDG.chainId,
    },
    options: { address: walletAddress, sponsor: true },
  } as const;
}
