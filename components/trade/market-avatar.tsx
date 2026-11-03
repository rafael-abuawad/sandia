import { cn } from "@/lib/utils";

function hue(label: string): number {
  let hash = 0;
  for (const char of label) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return hash;
}

/** Letter mark for a market. No remote logos, so lists stay fast and offline-safe. */
export function MarketAvatar({ symbol, className }: { symbol: string; className?: string }) {
  const h = hue(symbol);
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-bold tracking-tight",
        className,
      )}
      style={{
        backgroundColor: `oklch(0.92 0.05 ${h})`,
        color: `oklch(0.32 0.08 ${h})`,
      }}
    >
      {symbol.slice(0, 4)}
    </span>
  );
}
