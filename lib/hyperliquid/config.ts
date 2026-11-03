/** Hyperliquid Core settings shared by the app and Convex. */

export const HL_API_URL = "https://api.hyperliquid.xyz";

/**
 * Optional builder code. When set, every order carries it and the fee accrues to this address
 * (which needs 100 USDC in perps before Hyperliquid pays builder fees). Unset means no builder fee.
 */
export const HL_BUILDER_ADDRESS: `0x${string}` | null = parseAddress(
  process.env.NEXT_PUBLIC_HL_BUILDER_ADDRESS,
);

function parseAddress(value: string | undefined): `0x${string}` | null {
  const trimmed = value?.trim().toLowerCase();
  return trimmed && /^0x[0-9a-f]{40}$/.test(trimmed) ? (trimmed as `0x${string}`) : null;
}

/** Sandia's Hyperliquid referral code (https://app.hyperliquid.xyz/join/BOLIVIA). */
export const HL_REFERRAL_CODE = (process.env.NEXT_PUBLIC_HL_REFERRAL_CODE || "BOLIVIA").trim();

/**
 * Builder fee in tenths of a basis point (Hyperliquid's `f` field).
 * 50 = 5 bps = 0.05%. Hyperliquid caps perp builder fees at 100 (0.1%).
 */
export const HL_BUILDER_FEE_TENTHS_BPS = clampFee(
  Number(process.env.NEXT_PUBLIC_HL_BUILDER_FEE_TENTHS_BPS ?? 50),
);

function clampFee(value: number): number {
  if (!Number.isInteger(value) || value < 0) return 50;
  return Math.min(value, 100);
}

/** `approveBuilderFee` takes a percent string. 50 tenths of a bp → "0.05%". */
export function builderFeePercent(tenthsBps = HL_BUILDER_FEE_TENTHS_BPS): `${string}%` {
  return `${(tenthsBps / 1000).toString()}%`;
}

/** Fee as a fraction of notional. 50 → 0.0005. Zero when no builder is configured. */
export function builderFeeRate(
  tenthsBps = HL_BUILDER_ADDRESS ? HL_BUILDER_FEE_TENTHS_BPS : 0,
): number {
  return tenthsBps / 100_000;
}

/** The `builder` field for orders, or nothing when no builder is configured. */
export function orderBuilder():
  | { builder: { b: `0x${string}`; f: number } }
  | Record<string, never> {
  return HL_BUILDER_ADDRESS
    ? { builder: { b: HL_BUILDER_ADDRESS, f: HL_BUILDER_FEE_TENTHS_BPS } }
    : {};
}

/** Arbitrum One. Hyperliquid accepts any chain id for user-signed actions; this is the convention. */
export const HL_SIGNATURE_CHAIN_ID = "0xa4b1" as const;

/** Name shown for Sandia's trading key in Hyperliquid's API wallet list. */
export const HL_AGENT_NAME = "sandia";

/** HIP-3 dex that lists stocks, indices, commodities and FX. */
export const HL_STOCKS_DEX = "xyz";

/** Base taker fee on Hyperliquid perps before volume tiers, used for estimates only. */
export const HL_TAKER_FEE_RATE = 0.00045;

/** Market orders are IOC limits this far through the mark. */
export const HL_MARKET_SLIPPAGE = 0.01;

/** HyperCore as Across sees it. Payments settle to the payee's perps USDC balance. */
export const HYPERCORE_USDC = {
  symbol: "USDC",
  name: "USD Coin",
  /** Across's address for HyperCore perps USDC. */
  address: "0x2100000000000000000000000000000000000000",
  decimals: 6,
  chainId: 1337,
  chainName: "Hyperliquid",
  logoUrl: "/assets/tokens/usdc.svg",
  chainLogoUrl: "/assets/chains/hyperliquid.svg",
} as const;

/** USDC on the HyperCore spot ledger, for `spotSend` from unified accounts. */
export const HL_SPOT_USDC_TOKEN = "USDC:0x6d1e7cde53ba9467b783cb7c530ce054";
