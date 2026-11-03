"use client";

import { useId, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { formatMarketPrice } from "@/lib/hyperliquid/math";

type Point = { t: number; c: number };

const WIDTH = 360;
const HEIGHT = 180;

/** Touch-friendly area chart. Drag across it to read a price; let go to return to the latest. */
export function PriceChart({
  points,
  loading,
  onScrub,
}: {
  points: Point[] | undefined;
  loading?: boolean;
  onScrub?: (point: Point | null) => void;
}) {
  const gradientId = useId();
  const [active, setActive] = useState<number | null>(null);

  const shape = useMemo(() => {
    if (!points || points.length < 2) return null;
    const values = points.map((p) => p.c);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || max * 0.01 || 1;
    const xy = points.map((p, i) => ({
      x: (i / (points.length - 1)) * WIDTH,
      y: HEIGHT - 8 - ((p.c - min) / span) * (HEIGHT - 16),
    }));
    const line = xy
      .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
      .join("");
    return {
      xy,
      line,
      area: `${line}L${WIDTH},${HEIGHT}L0,${HEIGHT}Z`,
      up: values[values.length - 1] >= values[0],
    };
  }, [points]);

  if (!shape || !points) {
    return (
      <div
        className={cn(
          "h-44 w-full rounded-[var(--radius-lg)] bg-foreground/[0.03]",
          loading && "animate-pulse",
        )}
        role="status"
        aria-label={loading ? "Loading chart" : "No chart data"}
      />
    );
  }

  const color = shape.up ? "var(--success)" : "var(--danger)";

  function pick(clientX: number, rect: DOMRect) {
    if (!points) return;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const index = Math.round(ratio * (points.length - 1));
    setActive(index);
    onScrub?.(points[index]);
  }

  function release() {
    setActive(null);
    onScrub?.(null);
  }

  const marker = active !== null ? shape.xy[active] : null;
  const first = points[0];
  const last = points[points.length - 1];

  return (
    <figure className="relative m-0 select-none">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="h-44 w-full touch-none"
        role="img"
        aria-label={`Price from ${formatMarketPrice(first.c)} to ${formatMarketPrice(last.c)}`}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          pick(e.clientX, e.currentTarget.getBoundingClientRect());
        }}
        onPointerMove={(e) => {
          if (e.pointerType === "mouse" || e.buttons > 0)
            pick(e.clientX, e.currentTarget.getBoundingClientRect());
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onPointerLeave={release}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={shape.area} fill={`url(#${gradientId})`} />
        <path
          d={shape.line}
          fill="none"
          stroke={color}
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
        />
        {marker ? (
          <>
            <line
              x1={marker.x}
              x2={marker.x}
              y1="0"
              y2={HEIGHT}
              stroke="var(--border-strong)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          </>
        ) : null}
      </svg>
      {marker ? (
        <span
          aria-hidden
          className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-background"
          style={{
            left: `${(marker.x / WIDTH) * 100}%`,
            top: `${(marker.y / HEIGHT) * 100}%`,
            backgroundColor: color,
          }}
        />
      ) : null}
    </figure>
  );
}
