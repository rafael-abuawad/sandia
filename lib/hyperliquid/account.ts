import type { HlClearinghouseState, HlPosition, HlSpotState } from "./info";

export type AbstractionMode =
  | "unifiedAccount"
  | "portfolioMargin"
  | "disabled"
  | "default"
  | string;

export type PositionView = {
  coin: string;
  side: "long" | "short";
  /** Signed size: positive long, negative short. */
  size: number;
  entryPx: number;
  positionValue: number;
  unrealizedPnl: number;
  returnOnEquity: number;
  liquidationPx: number | null;
  marginUsed: number;
  leverage: number;
  marginType: "cross" | "isolated";
};

export type AccountSummary = {
  mode: AbstractionMode;
  unified: boolean;
  /** Everything the account is worth in USD, including open PnL. */
  equity: number;
  /** USDC free to trade or send. */
  available: number;
  unrealizedPnl: number;
  positions: PositionView[];
};

function num(value: string | null | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function isUnifiedMode(mode: AbstractionMode): boolean {
  return mode === "unifiedAccount" || mode === "portfolioMargin";
}

function toPosition(position: HlPosition): PositionView | null {
  const size = num(position.szi);
  if (size === 0) return null;
  const liq = position.liquidationPx === null ? null : num(position.liquidationPx);
  return {
    coin: position.coin,
    side: size > 0 ? "long" : "short",
    size,
    entryPx: num(position.entryPx),
    positionValue: num(position.positionValue),
    unrealizedPnl: num(position.unrealizedPnl),
    returnOnEquity: num(position.returnOnEquity),
    liquidationPx: liq && liq > 0 ? liq : null,
    marginUsed: num(position.marginUsed),
    leverage: position.leverage.value,
    marginType: position.leverage.type,
  };
}

/**
 * Collapse the per-dex clearinghouse states into one balance.
 *
 * Unified and portfolio-margin accounts keep collateral and holds on the spot ledger; their
 * per-dex perp states only carry positions. Standard accounts hold perp collateral per dex.
 */
export function summarizeAccount(input: {
  mode: AbstractionMode;
  perps: HlClearinghouseState[];
  spot: HlSpotState;
}): AccountSummary {
  const unified = isUnifiedMode(input.mode);
  const positions = input.perps
    .flatMap((state) => state.assetPositions.map(({ position }) => toPosition(position)))
    .filter((position): position is PositionView => position !== null)
    .sort((a, b) => Math.abs(b.positionValue) - Math.abs(a.positionValue));
  const unrealizedPnl = positions.reduce((sum, position) => sum + position.unrealizedPnl, 0);
  const usdc = input.spot.balances.find((balance) => balance.coin === "USDC");
  const spotTotal = num(usdc?.total);
  const spotHold = num(usdc?.hold);

  if (unified) {
    return {
      mode: input.mode,
      unified,
      equity: spotTotal + unrealizedPnl,
      available: Math.max(0, spotTotal - spotHold),
      unrealizedPnl,
      positions,
    };
  }

  const [main] = input.perps;
  return {
    mode: input.mode,
    unified,
    equity:
      input.perps.reduce((sum, state) => sum + num(state.marginSummary.accountValue), 0) +
      spotTotal,
    available: num(main?.withdrawable),
    unrealizedPnl,
    positions,
  };
}
