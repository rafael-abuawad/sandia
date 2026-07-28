"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

type TokenChainIconProps = {
  tokenSymbol: string;
  tokenLogoUrl?: string | null;
  chainName: string;
  chainLogoUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const SIZES = {
  sm: { token: 28, badge: 14 },
  md: { token: 36, badge: 16 },
  lg: { token: 44, badge: 18 },
} as const;

function FallbackMark({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={cn(
        "flex h-full w-full items-center justify-center bg-panel text-[10px] font-semibold uppercase text-[var(--accent-ink)]",
        className,
      )}
    >
      {label.slice(0, 2)}
    </span>
  );
}

export function TokenChainIcon({
  tokenSymbol,
  tokenLogoUrl,
  chainName,
  chainLogoUrl,
  size = "md",
  className,
}: TokenChainIconProps) {
  const dims = SIZES[size];
  const [tokenBroken, setTokenBroken] = useState(false);
  const [chainBroken, setChainBroken] = useState(false);

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: dims.token, height: dims.token }}
      aria-hidden
    >
      <div
        className="overflow-hidden rounded-full bg-[var(--panel-elevated)] ring-1 ring-border"
        style={{ width: dims.token, height: dims.token }}
      >
        {tokenLogoUrl && !tokenBroken ? (
          <Image
            src={tokenLogoUrl}
            alt=""
            width={dims.token}
            height={dims.token}
            className="h-full w-full object-cover"
            unoptimized
            onError={() => setTokenBroken(true)}
          />
        ) : (
          <FallbackMark label={tokenSymbol} />
        )}
      </div>
      <div
        className="absolute -bottom-0.5 -right-0.5 overflow-hidden rounded-full bg-background ring-2 ring-[var(--panel-elevated)]"
        style={{ width: dims.badge, height: dims.badge }}
        title={chainName}
      >
        {chainLogoUrl && !chainBroken ? (
          <Image
            src={chainLogoUrl}
            alt=""
            width={dims.badge}
            height={dims.badge}
            className="h-full w-full object-cover"
            unoptimized
            onError={() => setChainBroken(true)}
          />
        ) : (
          <FallbackMark label={chainName} className="text-[7px]" />
        )}
      </div>
    </div>
  );
}
