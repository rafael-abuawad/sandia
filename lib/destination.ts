/** Hardcoded destination for payment requests — Across on Robinhood currently settles USDG. */
export const ROBINHOOD_USDG = {
  symbol: "USDG",
  name: "Global Dollar",
  address: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",
  decimals: 6,
  chainId: 4663,
  chainName: "Robinhood",
  logoUrl: "/assets/tokens/usdg.svg",
  chainLogoUrl: "/assets/chains/robinhood.svg",
} as const;
