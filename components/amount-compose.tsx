"use client";

import { useId, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DEFAULT_PRESETS = [100, 300, 1000] as const;

type AmountComposeProps = {
  kicker: string;
  value: string;
  onChange: (value: string) => void;
  prefix?: string;
  suffix?: string;
  presets?: readonly number[];
  presetFormat?: (value: number) => string;
  detailsLabel?: string;
  detailsHint?: string;
  onDetailsClick?: () => void;
  children?: ReactNode;
  footer: ReactNode;
  error?: ReactNode;
  inputId?: string;
  invalid?: boolean;
};

function sanitizeAmount(raw: string): string {
  const next = raw.replace(/[^\d.]/g, "");
  const firstDot = next.indexOf(".");
  if (firstDot === -1) return next.replace(/^0+(?=\d)/, "") || (next.includes("0") ? "0" : "");
  const whole = next.slice(0, firstDot).replace(/^0+(?=\d)/, "") || "0";
  const frac = next
    .slice(firstDot + 1)
    .replace(/\./g, "")
    .slice(0, 6);
  return `${whole}.${frac}`;
}

function displayAmount(value: string): string {
  if (!value || value === ".") return "0";
  return value;
}

export function AmountCompose({
  kicker,
  value,
  onChange,
  prefix = "$",
  suffix,
  presets = DEFAULT_PRESETS,
  presetFormat,
  detailsLabel,
  detailsHint,
  onDetailsClick,
  children,
  footer,
  error,
  inputId,
  invalid,
}: AmountComposeProps) {
  const generatedId = useId();
  const id = inputId ?? generatedId;
  const shown = displayAmount(value);
  const inputWidthCh = Math.max(shown.length, 1) + 0.5;

  return (
    <div className="flex flex-col gap-3">
      <div className="pr-panel px-4 pt-4 pb-4 sm:px-5 sm:pt-5 sm:pb-4">
        <p className="pr-kicker">{kicker}</p>
        <div className="mt-3 flex justify-center px-2">
          <label htmlFor={id} className="flex max-w-full cursor-text items-baseline justify-center">
            {prefix ? (
              <span className="pr-display pr-money text-[2.75rem] leading-none text-foreground sm:text-5xl">
                {prefix}
              </span>
            ) : null}
            <input
              id={id}
              inputMode="decimal"
              autoComplete="off"
              value={shown}
              onChange={(e) => onChange(sanitizeAmount(e.target.value))}
              onFocus={(e) => e.currentTarget.select()}
              aria-invalid={invalid || undefined}
              className="pr-display pr-money bg-transparent p-0 text-center text-[2.75rem] leading-none text-foreground outline-none sm:text-5xl"
              style={{ width: `${inputWidthCh}ch` }}
            />
            {suffix ? (
              <span className="pr-display ms-1.5 text-lg leading-none text-muted sm:text-xl">
                {suffix}
              </span>
            ) : null}
          </label>
        </div>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {presets.map((preset) => {
            const label = presetFormat ? presetFormat(preset) : `${prefix}${preset}`;
            const selected = value === String(preset) || value === `${preset}.00`;
            return (
              <Button
                key={preset}
                type="button"
                variant="outline"
                size="sm"
                aria-pressed={selected}
                className={cn("min-w-[4.5rem] rounded-full", selected && "border-foreground")}
                onClick={() => onChange(String(preset))}
              >
                {label}
              </Button>
            );
          })}
        </div>
      </div>

      {onDetailsClick ? (
        <button
          type="button"
          onClick={onDetailsClick}
          className="pr-panel flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left transition-[border-color] duration-[var(--duration)] ease-[var(--ease-out)] hover:border-border-strong"
        >
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-foreground">{detailsLabel}</span>
            {detailsHint ? (
              <span className="mt-0.5 block truncate text-xs text-muted">{detailsHint}</span>
            ) : null}
          </span>
          <ChevronRight className="size-5 shrink-0 text-muted" strokeWidth={1.5} aria-hidden />
        </button>
      ) : null}

      {children}

      {error}

      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 -mx-1 bg-[color-mix(in_srgb,var(--background)_92%,transparent)] px-1 py-3 backdrop-blur-sm md:static md:bottom-auto md:bg-transparent md:p-0 md:backdrop-blur-none">
        {footer}
      </div>
    </div>
  );
}

export function isAmountEntered(value: string): boolean {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) && n > 0;
}
