"use client";

import Image from "next/image";
import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TokenChainIcon } from "@/components/token-chain-icon";
import { cn } from "@/lib/utils";

export type TokenChainOption = {
  value: string;
  tokenSymbol: string;
  tokenLogoUrl?: string | null;
  chainName: string;
  chainLogoUrl?: string | null;
};

export type ChainOption = {
  value: string;
  name: string;
  logoUrl?: string | null;
};

export type TokenOption = {
  value: string;
  symbol: string;
  logoUrl?: string | null;
};

function AssetIcon({
  label,
  logoUrl,
  size = 36,
}: {
  label: string;
  logoUrl?: string | null;
  size?: number;
}) {
  const [broken, setBroken] = useState(false);
  return (
    <div
      className="shrink-0 overflow-hidden rounded-full bg-[var(--panel-elevated)] ring-1 ring-border"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {logoUrl && !broken ? (
        <Image
          src={logoUrl}
          alt=""
          width={size}
          height={size}
          className="h-full w-full object-cover"
          unoptimized
          onError={() => setBroken(true)}
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center bg-panel text-[10px] font-semibold uppercase text-[var(--accent-ink)]">
          {label.slice(0, 2)}
        </span>
      )}
    </div>
  );
}

type IconSelectProps<T extends { value: string }> = {
  value?: string;
  onValueChange: (value: string) => void;
  options: T[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  renderOption: (option: T) => React.ReactNode;
};

function IconSelect<T extends { value: string }>({
  value,
  onValueChange,
  options,
  placeholder,
  disabled,
  className,
  renderOption,
}: IconSelectProps<T>) {
  const selected = options.find((o) => o.value === value);

  return (
    <Select value={value || undefined} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger
        className={cn(
          "h-14 w-full gap-3 border-[var(--border-strong)] bg-[var(--panel-elevated)] px-3 py-2",
          className,
        )}
      >
        {selected ? renderOption(selected) : <SelectValue placeholder={placeholder} />}
      </SelectTrigger>
      <SelectContent className="max-h-80">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} className="py-2.5">
            {renderOption(option)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ChainSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select chain",
  disabled,
  className,
}: {
  value?: string;
  onValueChange: (value: string) => void;
  options: ChainOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <IconSelect
      value={value}
      onValueChange={onValueChange}
      options={options}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
      renderOption={(option) => (
        <span className="flex min-w-0 items-center gap-3">
          <AssetIcon label={option.name} logoUrl={option.logoUrl} />
          <span className="truncate text-sm font-semibold text-foreground">{option.name}</span>
        </span>
      )}
    />
  );
}

export function TokenSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select token",
  disabled,
  className,
}: {
  value?: string;
  onValueChange: (value: string) => void;
  options: TokenOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <IconSelect
      value={value}
      onValueChange={onValueChange}
      options={options}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
      renderOption={(option) => (
        <span className="flex min-w-0 items-center gap-3">
          <AssetIcon label={option.symbol} logoUrl={option.logoUrl} />
          <span className="truncate text-sm font-semibold text-foreground">{option.symbol}</span>
        </span>
      )}
    />
  );
}

/** Static display chip (create form / destination summary). */
export function TokenChainChip({
  tokenSymbol,
  tokenLogoUrl,
  chainName,
  chainLogoUrl,
  className,
}: Omit<TokenChainOption, "value"> & { className?: string }) {
  return (
    <div
      className={cn(
        "flex h-14 items-center gap-3 rounded-md border border-[var(--border-strong)] bg-[var(--panel-elevated)] px-3",
        className,
      )}
    >
      <TokenChainIcon
        tokenSymbol={tokenSymbol}
        tokenLogoUrl={tokenLogoUrl}
        chainName={chainName}
        chainLogoUrl={chainLogoUrl}
        size="md"
      />
      <div className="flex min-w-0 flex-col">
        <span className="text-sm font-semibold text-foreground">{tokenSymbol}</span>
        <span className="text-xs text-subtle">{chainName}</span>
      </div>
    </div>
  );
}
