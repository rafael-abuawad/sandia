import type { HlFill, HlLedgerUpdate } from "./info";

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
