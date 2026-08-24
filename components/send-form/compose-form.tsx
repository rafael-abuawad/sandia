"use client";

import { useEffect, useId, useRef, useState } from "react";
import { LoginButton } from "@/components/login-button";
import { Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { TokenChainChip } from "@/components/token-chain-select";
import { AmountCompose, isAmountEntered } from "@/components/amount-compose";
import { AddressBookButton, ContactPicker } from "@/components/address-book/contact-picker";
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
  const recipientRef = useRef<HTMLInputElement>(null);
  const firstRowRef = useRef<HTMLInputElement>(null);
  const errorId = useId();
  const [bookOpen, setBookOpen] = useState(false);
  const [bookRowId, setBookRowId] = useState<string | null>(null);
  const [bookDraft, setBookDraft] = useState("");

  useEffect(() => {
    if (!error) return;
    if (mode === "single") {
      recipientRef.current?.focus();
      return;
    }
    firstRowRef.current?.focus();
  }, [error, mode]);

  function openBook(draft: string, rowId: string | null = null) {
    setBookDraft(draft);
    setBookRowId(rowId);
    setBookOpen(true);
  }

  function onPickAddress(address: string) {
    if (bookRowId) {
      dispatch({ type: "updateRow", id: bookRowId, patch: { address } });
      return;
    }
    dispatch({ type: "setSingleAddress", address });
  }

  const modeToggle = (
    <div className="grid grid-cols-2 gap-2" role="group" aria-label="Send mode">
      <Button
        type="button"
        variant={mode === "single" ? "default" : "outline"}
        aria-pressed={mode === "single"}
        className={cn(mode === "single" && "pointer-events-none")}
        onClick={() => dispatch({ type: "setMode", mode: "single" })}
      >
        Single
      </Button>
      <Button
        type="button"
        variant={mode === "massive" ? "default" : "outline"}
        aria-pressed={mode === "massive"}
        className={cn(mode === "massive" && "pointer-events-none")}
        onClick={() => dispatch({ type: "setMode", mode: "massive" })}
      >
        Massive
      </Button>
    </div>
  );

  const footer = !isConnected ? (
    <div className="flex flex-col items-stretch gap-3">
      <p className="text-sm text-muted">
        Sign in to continue this demo send. No transaction will be sent yet.
      </p>
      <LoginButton />
    </div>
  ) : (
    <Button
      type="submit"
      className="w-full"
      size="lg"
      disabled={mode === "single" && !isAmountEntered(singleAmount)}
    >
      {mode === "single" && !isAmountEntered(singleAmount) ? "Enter an amount" : "Review send"}
    </Button>
  );

  return (
    <form onSubmit={onSubmit} className="space-y-3" noValidate>
      {modeToggle}
      {mode === "single" ? (
        <AmountCompose
          kicker="You're sending"
          prefix="$"
          suffix="USDG"
          value={singleAmount}
          onChange={(amount) => dispatch({ type: "setSingleAmount", amount })}
          footer={footer}
          error={<FieldError id={errorId} message={error} />}
        >
          <div className="space-y-2">
            <Label htmlFor="send-recipient">To</Label>
            <InputGroup>
              <InputGroupInput
                ref={recipientRef}
                id="send-recipient"
                value={singleAddress}
                onChange={(e) => dispatch({ type: "setSingleAddress", address: e.target.value })}
                placeholder="0x… or pick from address book"
                required
                aria-invalid={Boolean(error) || undefined}
                aria-describedby={error ? errorId : undefined}
                className="pr-mono"
              />
              <InputGroupAddon>
                <AddressBookButton onClick={() => openBook(singleAddress)} />
              </InputGroupAddon>
            </InputGroup>
          </div>
        </AmountCompose>
      ) : (
        <>
          <p className="pr-help">
            Send different USDG amounts to multiple recipients in one batch.
          </p>
          <TokenChainChip
            tokenSymbol={ROBINHOOD_USDG.symbol}
            tokenLogoUrl={ROBINHOOD_USDG.logoUrl}
            chainName={ROBINHOOD_USDG.chainName}
            chainLogoUrl={ROBINHOOD_USDG.chainLogoUrl}
            chainId={ROBINHOOD_USDG.chainId}
          />
          <div className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <Label>Recipients</Label>
              {liveTotalLabel && (
                <p className="pr-mono text-xs text-muted">Total {liveTotalLabel} USDG</p>
              )}
            </div>
            <ul className="space-y-3">
              {rows.map((row, index) => (
                <li key={row.id} className="pr-inset space-y-2 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-muted">Recipient {index + 1}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted hover:text-danger"
                      disabled={rows.length <= 2}
                      aria-label={`Remove recipient ${index + 1}`}
                      onClick={() => dispatch({ type: "removeRow", id: row.id })}
                    >
                      <Trash2 className="size-4" strokeWidth={1.5} aria-hidden />
                    </Button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor={`send-addr-${row.id}`}>Wallet</Label>
                      <InputGroup>
                        <InputGroupInput
                          ref={index === 0 ? firstRowRef : undefined}
                          id={`send-addr-${row.id}`}
                          value={row.address}
                          onChange={(e) =>
                            dispatch({
                              type: "updateRow",
                              id: row.id,
                              patch: { address: e.target.value },
                            })
                          }
                          placeholder="0x…"
                          required
                          className="pr-mono"
                        />
                        <InputGroupAddon>
                          <AddressBookButton
                            onClick={() => openBook(row.address, row.id)}
                            label={`Address book for recipient ${index + 1}`}
                          />
                        </InputGroupAddon>
                      </InputGroup>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`send-amt-${row.id}`}>Amount (USDG)</Label>
                      <Input
                        id={`send-amt-${row.id}`}
                        inputMode="decimal"
                        value={row.amount}
                        onChange={(e) =>
                          dispatch({
                            type: "updateRow",
                            id: row.id,
                            patch: { amount: e.target.value },
                          })
                        }
                        placeholder="10.00"
                        required
                      />
                    </div>
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
                    error:
                      err instanceof Error
                        ? err.message
                        : "Unable to parse CSV. Check the format and try again.",
                  });
                }
              }}
            />
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => dispatch({ type: "addRow" })}
              >
                <Plus className="size-4" strokeWidth={1.5} aria-hidden />
                Add recipient
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => csvInputRef.current?.click()}
              >
                <Upload className="size-4" strokeWidth={1.5} aria-hidden />
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
                className="font-medium text-foreground underline underline-offset-2 hover:text-foreground"
              >
                Download template
              </a>
            </p>
          </div>
          <FieldError id={errorId} message={error} />
          <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 -mx-1 bg-[color-mix(in_srgb,var(--background)_92%,transparent)] px-1 py-3 backdrop-blur-sm md:static md:bottom-auto md:bg-transparent md:p-0 md:backdrop-blur-none">
            {footer}
          </div>
        </>
      )}

      <ContactPicker
        open={bookOpen}
        onOpenChange={setBookOpen}
        onSelect={onPickAddress}
        draftAddress={bookDraft}
      />
    </form>
  );
}
