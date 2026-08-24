"use client";

import Image from "next/image";
import { useState } from "react";
import { resolveChainIcon, resolveTokenIcon } from "@/lib/asset-icons";
import { cn } from "@/lib/utils";

type TokenChainIconProps = {
  tokenSymbol: string;
  tokenLogoUrl?: string | null;
  chainName: string;
  chainLogoUrl?: string | null;
  chainId?: number | null;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const SIZES = {
  sm: { token: 20, badge: 10 },
  md: { token: 24, badge: 12 },
  lg: { token: 32, badge: 14 },
} as const;

function FallbackMark({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={cn(
        "flex h-full w-full items-center justify-center bg-panel text-[8px] font-semibold uppercase text-accent-ink",
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
  chainId,
  size = "md",
  className,
}: TokenChainIconProps) {
  const dims = SIZES[size];
  const [tokenBroken, setTokenBroken] = useState(false);
  const [chainBroken, setChainBroken] = useState(false);
  const tokenSrc = resolveTokenIcon(tokenSymbol, tokenLogoUrl);
  const chainSrc = resolveChainIcon(chainId, chainName, chainLogoUrl);

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
        {tokenSrc && !tokenBroken ? (
          <Image
            src={tokenSrc}
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
        className="absolute -right-0.5 -bottom-0.5 overflow-hidden rounded-full bg-background ring-2 ring-[var(--panel-elevated)]"
        style={{ width: dims.badge, height: dims.badge }}
        title={chainName}
      >
        {chainSrc && !chainBroken ? (
          <Image
            src={chainSrc}
            alt=""
            width={dims.badge}
            height={dims.badge}
            className="h-full w-full object-cover"
            unoptimized
            onError={() => setChainBroken(true)}
          />
        ) : (
          <FallbackMark label={chainName} className="text-[6px]" />
        )}
      </div>
    </div>
  );
}
