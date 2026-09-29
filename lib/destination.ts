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

/** Wrapped ETH on Robinhood. The pay screen labels this token ETH. */
export const ROBINHOOD_WETH = "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73" as const;

/** USDG on Robinhood settles with a same-chain transfer. */
export function isDirectUsdgPay(chainId: number | null, tokenAddress: string): boolean {
  if (chainId !== ROBINHOOD_USDG.chainId || !tokenAddress) return false;
  return isRobinhoodUsdgAddress(tokenAddress);
}

/**
 * True for Robinhood USDG in either checksum or lowercase form.
 * Payment requests persist the lowercase address.
 */
export function isRobinhoodUsdgAddress(address: string): boolean {
  return address.toLowerCase() === ROBINHOOD_USDG.address.toLowerCase();
}

/** ETH on Robinhood swaps to USDG through 0x. Across does not quote same-chain routes. */
export function isRobinhoodEthPay(chainId: number | null, tokenAddress: string): boolean {
  if (chainId !== ROBINHOOD_USDG.chainId || !tokenAddress) return false;
  return tokenAddress.toLowerCase() === ROBINHOOD_WETH.toLowerCase();
}
