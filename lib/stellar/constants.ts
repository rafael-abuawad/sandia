/** Stellar network and asset constants. No SDK import, so Convex queries and mutations can use this. */

export const STELLAR_NETWORK_PASSPHRASE = "Public Global Stellar Network ; September 2015";

export const HORIZON_URL =
  process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL || "https://horizon.stellar.org";

export const EXPLORER_URL = "https://stellar.expert/explorer/public";

/** Circle-issued USDC on Stellar. Classic assets use 7 decimals. */
export const STELLAR_USDC = {
  symbol: "USDC",
  name: "USD Coin",
  issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
  contractId: "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
  decimals: 7,
  chainName: "Stellar",
  logoUrl: "/assets/tokens/usdc.svg",
  chainLogoUrl: "/assets/chains/stellar.svg",
} as const;

/** A Stellar transaction carries at most 100 operations. */
export const MAX_SEND_RECIPIENTS = 100;

export function explorerTxUrl(hash: string): string | null {
  if (!/^[0-9a-f]{64}$/i.test(hash)) return null;
  return `${EXPLORER_URL}/tx/${hash.toLowerCase()}`;
}
