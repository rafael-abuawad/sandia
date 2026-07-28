"use client";

import { useRef } from "react";
import { ConnectKitButton } from "connectkit";
import { Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TokenChainChip } from "@/components/token-chain-select";
import { ROBINHOOD_USDG } from "@/lib/destination";
import { cn } from "@/lib/utils";
import { parseRecipientsCsv } from "@/components/send-form/helpers";
import type { RecipientRow, SendFormAction, SendMode } from "@/components/send-form/state";

type SendComposeFormProps = {
  mode: SendMode;
  singleAddress: string;
  singleAmount: string;
  rows: RecipientRow[];
  liveTotalLabel: string | null;
  error: string | null;
  isConnected: boolean;
  dispatch: React.Dispatch<SendFormAction>;
  onSubmit: (e: React.FormEvent) => void;
};

export function SendComposeForm({
  mode,
  singleAddress,
  singleAmount,
  rows,
  liveTotalLabel,
  error,
  isConnected,
  dispatch,
  onSubmit,
}: SendComposeFormProps) {
  const csvInputRef = useRef<HTMLInputElement>(null);

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-lg space-y-5">
      <div className="space-y-2">
        <Label>Send mode</Label>
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Send mode">
          <Button
            type="button"
            variant={mode === "single" ? "default" : "outline"}
            className={cn(mode === "single" && "pointer-events-none")}
            onClick={() => dispatch({ type: "setMode", mode: "single" })}
          >
            Single
          </Button>
          <Button
            type="button"
            variant={mode === "massive" ? "default" : "outline"}
            className={cn(mode === "massive" && "pointer-events-none")}
            onClick={() => dispatch({ type: "setMode", mode: "massive" })}
          >
            Massive
          </Button>
        </div>
        <p className="pr-help">
          {mode === "single"
            ? "Send USDG to one recipient."
            : "Send different USDG amounts to multiple recipients in one batch."}
        </p>
      </div>

      <div className="space-y-2">
        <Label>Asset</Label>
        <TokenChainChip
          tokenSymbol={ROBINHOOD_USDG.symbol}
          tokenLogoUrl={ROBINHOOD_USDG.logoUrl}
          chainName={ROBINHOOD_USDG.chainName}
          chainLogoUrl={ROBINHOOD_USDG.chainLogoUrl}
        />
        <p className="pr-help">Demo send of USDG on Robinhood Chain. Batch contract coming soon.</p>
      </div>

      {mode === "single" ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="send-amount">Amount (USDG)</Label>
            <Input
              id="send-amount"
              inputMode="decimal"
              value={singleAmount}
              onChange={(e) => dispatch({ type: "setSingleAmount", amount: e.target.value })}
              placeholder="10.00"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="send-recipient">Recipient wallet</Label>
            <Input
              id="send-recipient"
              value={singleAddress}
              onChange={(e) => dispatch({ type: "setSingleAddress", address: e.target.value })}
              placeholder="0x…"
              required
            />
          </div>
        </>
      ) : (
        <div className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <Label>Recipients</Label>
            {liveTotalLabel && (
              <p className="pr-mono text-xs text-muted">Total {liveTotalLabel} USDG</p>
            )}
          </div>

          <ul className="space-y-3">
            {rows.map((row, index) => (
              <li key={row.id} className="pr-panel space-y-2 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted">Recipient {index + 1}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted hover:text-danger"
                    disabled={rows.length <= 2}
                    aria-label={`Remove recipient ${index + 1}`}
                    onClick={() => dispatch({ type: "removeRow", id: row.id })}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <div className="space-y-2">
                  <Input
                    value={row.address}
                    onChange={(e) =>
                      dispatch({
                        type: "updateRow",
                        id: row.id,
                        patch: { address: e.target.value },
                      })
                    }
                    placeholder="0x…"
                    aria-label={`Address for recipient ${index + 1}`}
                    required
                  />
                  <Input
                    inputMode="decimal"
                    value={row.amount}
                    onChange={(e) =>
                      dispatch({
                        type: "updateRow",
                        id: row.id,
                        patch: { amount: e.target.value },
                      })
                    }
                    placeholder="Amount (USDG)"
                    aria-label={`Amount for recipient ${index + 1}`}
                    required
                  />
                </div>
              </li>
            ))}
          </ul>

          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            aria-hidden
            tabIndex={-1}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              dispatch({ type: "setError", error: null });
              try {
                const text = await file.text();
                dispatch({ type: "setRows", rows: parseRecipientsCsv(text) });
              } catch (err) {
                dispatch({
                  type: "setError",
                  error: err instanceof Error ? err.message : "Failed to parse CSV",
                });
              }
            }}
          />
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="secondary" onClick={() => dispatch({ type: "addRow" })}>
              <Plus className="size-4" />
              Add recipient
            </Button>
            <Button type="button" variant="secondary" onClick={() => csvInputRef.current?.click()}>
              <Upload className="size-4" />
              Upload CSV
            </Button>
          </div>
          <p className="pr-help">
            CSV format: address,amount (header optional). Replaces the current recipient list.{" "}
            <a
              href={`data:text/csv;charset=utf-8,${encodeURIComponent(
                "address,amount\n0x0000000000000000000000000000000000000001,10.00\n0x0000000000000000000000000000000000000002,25.50\n",
              )}`}
              download="usdg-send-template.csv"
              className="font-medium text-foreground underline underline-offset-2 hover:text-[var(--accent-ink)]"
            >
              Download template
            </a>
          </p>
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      {!isConnected ? (
        <div className="flex flex-col items-stretch gap-3">
          <p className="text-sm text-muted">
            Connect a wallet to continue this demo send. No transaction will be sent yet.
          </p>
          <ConnectKitButton />
        </div>
      ) : (
        <Button type="submit" className="w-full">
          Continue
        </Button>
      )}
    </form>
  );
}
