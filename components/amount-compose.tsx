"use client";

import { useId, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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

function selectedPreset(value: string, presets: readonly number[]): string {
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n)) return "";
  const match = presets.find((preset) => preset === n);
  return match !== undefined ? String(match) : "";
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
  const selected = selectedPreset(value, presets);

  return (
    <div className="flex flex-col gap-3">
      <div className="pr-panel space-y-3 px-4 py-4 sm:px-5">
        <label htmlFor={id} className="pr-kicker">
          {kicker}
        </label>
        <InputGroup className={cn(invalid && "border-danger")}>
          {prefix ? (
            <InputGroupAddon
              align="inline-start"
              className="pointer-events-none px-3 text-sm text-muted"
            >
              {prefix}
            </InputGroupAddon>
          ) : null}
          <InputGroupInput
            id={id}
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            value={value}
            onChange={(e) => onChange(sanitizeAmount(e.target.value))}
            aria-invalid={invalid || undefined}
            className={cn("pr-money", prefix && "pl-0")}
          />
          {suffix ? (
            <InputGroupAddon className="pointer-events-none px-3 text-xs font-semibold text-muted">
              {suffix}
            </InputGroupAddon>
          ) : null}
        </InputGroup>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          spacing={2}
          value={selected}
          onValueChange={(next) => {
            if (next) onChange(next);
          }}
          aria-label="Suggested amounts"
          className="flex w-full flex-wrap gap-2"
        >
          {presets.map((preset) => {
            const label = presetFormat ? presetFormat(preset) : `${prefix}${preset}`;
            return (
              <ToggleGroupItem
                key={preset}
                value={String(preset)}
                className="min-w-[4.5rem] flex-1"
              >
                {label}
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
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
