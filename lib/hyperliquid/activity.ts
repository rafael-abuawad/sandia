import { info, type HlFill, type HlLedgerUpdate } from "./info";

export type HlActivityItem = {
  id: string;
  kind: "trade" | "received" | "sent" | "deposit" | "withdraw";
  title: string;
  detail: string;
  /** Signed USD change to the balance where it is known. */
  amountUsd: number | null;
  time: number;
};

function num(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function short(address: string | undefined): string {
  return address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "";
}

function coinLabel(coin: string): string {
  return coin.replace(/^[a-z0-9]+:/, "");
}

/** Readable feed of fills and USDC movements, newest first. */
export function buildHlActivity(
  user: string,
  fills: HlFill[],
  ledger: HlLedgerUpdate[],
): HlActivityItem[] {
  const me = user.toLowerCase();
  const items: HlActivityItem[] = fills.map((fill) => {
    const pnl = num(fill.closedPnl);
    return {
      id: `fill-${fill.hash}-${fill.oid}`,
      kind: "trade",
      title: `${fill.dir || (fill.side === "B" ? "Buy" : "Sell")} ${coinLabel(fill.coin)}`,
      detail: `${fill.sz} at $${num(fill.px).toLocaleString("en-US", { maximumFractionDigits: 6 })}`,
      amountUsd: pnl !== 0 ? pnl - num(fill.fee) : null,
      time: fill.time,
    };
  });

  for (const update of ledger) {
    const delta = update.delta;
    const id = `ledger-${update.hash}-${delta.type}`;
    if (delta.type === "deposit") {
      items.push({
        id,
        kind: "deposit",
        title: "Deposit",
        detail: "USDC arrived",
        amountUsd: num(delta.usdc),
        time: update.time,
      });
    } else if (delta.type === "withdraw") {
      items.push({
        id,
        kind: "withdraw",
        title: "Withdrawal",
        detail: "USDC to Arbitrum",
        amountUsd: -num(delta.usdc),
        time: update.time,
      });
    } else if (
      delta.type === "send" ||
      delta.type === "spotTransfer" ||
      delta.type === "internalTransfer"
    ) {
      if (delta.token && delta.token !== "USDC" && delta.type !== "internalTransfer") continue;
      const amount = num(delta.usdcValue ?? delta.amount ?? delta.usdc);
      const outgoing = delta.user?.toLowerCase() === me;
      // Moves between your own perp and spot balances are not money in or out.
      if (outgoing && delta.destination?.toLowerCase() === me) continue;
      items.push({
        id,
        kind: outgoing ? "sent" : "received",
        title: outgoing ? "Sent USDC" : "Received USDC",
        detail: outgoing ? `To ${short(delta.destination)}` : `From ${short(delta.user)}`,
        amountUsd: outgoing ? -amount : amount,
        time: update.time,
      });
    }
  }

  return items.sort((a, b) => b.time - a.time);
}

/** Rows revealed on each "Load more", and the first screen. */
export const ACTIVITY_PAGE_SIZE = 20;

/** History the activity page will walk back through. */
export const HL_ACTIVITY_LOOKBACK_MS = 90 * 24 * 60 * 60 * 1000;

const WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_WINDOWS = 6;
const MIN_WINDOW_MS = 60 * 1000;
const FILL_CAP = 2000;
const LEDGER_CAP = 500;

export type ActivitySource<T> = {
  items: T[];
  /** More rows exist older than `items`. An empty source that is still loading counts. */
  hasMore: boolean;
};

/**
 * Items safe to show from a merged newest-first feed.
 * A source that still has older rows hides anything older than its oldest loaded row,
 * so a deposit from last month cannot appear above trades that have not been fetched yet.
 * While any source is still loading its first page, nothing is shown.
 */
export function visibleActivity<T extends { time: number }>(sources: ActivitySource<T>[]): T[] {
  let waitingForFirstPage = false;
  let cutoff = -Infinity;
  for (const source of sources) {
    if (!source.hasMore) continue;
    if (source.items.length === 0) {
      waitingForFirstPage = true;
      continue;
    }
    const oldest = source.items.reduce((min, item) => Math.min(min, item.time), Infinity);
    cutoff = Math.max(cutoff, oldest);
  }
  if (waitingForFirstPage) return [];
  const merged = sources.flatMap((source) => source.items).sort((a, b) => b.time - a.time);
  if (cutoff === -Infinity) return merged;
  return merged.filter((item) => item.time >= cutoff);
}

/**
 * Which sources should fetch the next page. Only the ones sitting on the frontier
 * (their oldest loaded row is the newest among sources that still have more).
 */
export function sourcesToLoad(
  sources: Array<{ oldest: number | null; hasMore: boolean }>,
): boolean[] {
  const frontiers = sources
    .filter((source) => source.hasMore && source.oldest !== null)
    .map((source) => source.oldest as number);
  const cutoff = frontiers.length > 0 ? Math.max(...frontiers) : Infinity;
  return sources.map((source) => {
    if (!source.hasMore) return false;
    if (source.oldest === null) return true;
    return source.oldest >= cutoff;
  });
}

export function mergeActivityItems(pages: HlActivityItem[][]): HlActivityItem[] {
  const seen = new Set<string>();
  const items: HlActivityItem[] = [];
  for (const page of pages) {
    for (const item of page) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      items.push(item);
    }
  }
  return items.sort((a, b) => b.time - a.time);
}

/** Where the next Hyperliquid request should end, and whether to keep scanning to fill a page. */
export function nextActivityCursor(input: {
  startTime: number;
  floor: number;
  itemCount: number;
  pageSize: number;
  fillsCapped: boolean;
  oldestFillTime: number | null;
}): { nextEndTime: number | null; continueScan: boolean } {
  if (input.fillsCapped && input.oldestFillTime !== null) {
    return { nextEndTime: input.oldestFillTime - 1, continueScan: false };
  }
  const nextEndTime = input.startTime > input.floor ? input.startTime - 1 : null;
  return {
    nextEndTime,
    continueScan: input.itemCount < input.pageSize && nextEndTime !== null,
  };
}

/**
 * One page of trades and USDC movements ending at `endTime` (inclusive), walking backward
 * until there are {@link ACTIVITY_PAGE_SIZE} rows or the lookback floor is reached.
 * Hyperliquid caps a fill response at 2000 and a ledger response at 500, so a saturated
 * ledger window is narrowed before it is kept.
 */
export async function fetchHlActivityPage(
  user: string,
  endTime: number,
  floor: number,
  signal?: AbortSignal,
): Promise<{ items: HlActivityItem[]; nextEndTime: number | null }> {
  let cursor = endTime;
  let span = WINDOW_MS;
  let collected: HlActivityItem[] = [];
  let nextEndTime: number | null = null;

  for (let round = 0; round < MAX_WINDOWS && cursor > floor; round++) {
    let start = Math.max(floor, cursor - span);
    let fills: HlFill[] = [];
    let ledger: HlLedgerUpdate[] = [];

    for (let attempt = 0; attempt < 6; attempt++) {
      [fills, ledger] = await Promise.all([
        info.userFillsByTime(user, start, cursor, signal),
        info.userNonFundingLedgerUpdates(user, start, cursor, signal),
      ]);
      if (ledger.length < LEDGER_CAP || cursor - start <= MIN_WINDOW_MS) break;
      const narrowed = start + Math.ceil((cursor - start) / 2);
      if (narrowed >= cursor) break;
      start = narrowed;
      console.info("Narrowed Hyperliquid activity window", {
        user,
        start,
        end: cursor,
        ledger: ledger.length,
      });
    }

    const fillsCapped = fills.length >= FILL_CAP;
    const oldestFillTime = fillsCapped
      ? fills.reduce((min, fill) => Math.min(min, fill.time), Infinity)
      : null;
    const windowItems = buildHlActivity(user, fills, ledger).filter(
      (item) =>
        item.time <= cursor &&
        item.time >= start &&
        (oldestFillTime === null || item.time >= oldestFillTime),
    );
    collected = mergeActivityItems([collected, windowItems]);
    const decision = nextActivityCursor({
      startTime: start,
      floor,
      itemCount: collected.length,
      pageSize: ACTIVITY_PAGE_SIZE,
      fillsCapped,
      oldestFillTime,
    });
    nextEndTime = decision.nextEndTime;
    console.info("Fetched Hyperliquid activity window", {
      user,
      start,
      end: cursor,
      fills: fills.length,
      ledger: ledger.length,
      kept: collected.length,
      nextEndTime,
    });
    if (!decision.continueScan) break;
    if (decision.nextEndTime === null) break;
    cursor = decision.nextEndTime;
    span = Math.min(span * 4, MAX_WINDOW_MS);
  }

  return { items: collected, nextEndTime };
}
