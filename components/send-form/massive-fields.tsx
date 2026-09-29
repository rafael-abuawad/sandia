"use client";

import { useRef } from "react";
import { Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { AddressBookButton } from "@/components/address-book/contact-picker";
import { TokenChainChip } from "@/components/token-chain-select";
import { ROBINHOOD_USDG } from "@/lib/destination";
import { parseRecipientsCsv, type SendFieldErrors } from "@/components/send-form/helpers";
import type { RecipientRow, SendFormAction } from "@/components/send-form/state";

export function MassiveSendFields({
  rows,
  fieldErrors,
  liveTotalLabel,
  dispatch,
  openBook,
}: {
  rows: RecipientRow[];
  fieldErrors: SendFieldErrors;
  liveTotalLabel: string | null;
  dispatch: React.Dispatch<SendFormAction>;
  openBook: (draft: string, rowId: string | null, startOnSave: boolean) => void;
}) {
  const csvInputRef = useRef<HTMLInputElement>(null);

  async function loadCsv(file: File | undefined) {
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
  }

  return (
    <>
      <p className="pr-help">Send different USDG amounts to multiple recipients in one batch.</p>
      <TokenChainChip
        tokenSymbol={ROBINHOOD_USDG.symbol}
        tokenLogoUrl={ROBINHOOD_USDG.logoUrl}
        chainName={ROBINHOOD_USDG.chainName}
        chainLogoUrl={ROBINHOOD_USDG.chainLogoUrl}
        chainId={ROBINHOOD_USDG.chainId}
      />
      <div className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <p className="text-sm font-medium">Recipients</p>
          {liveTotalLabel ? (
            <p className="pr-mono text-xs text-muted">Total {liveTotalLabel} USDG</p>
          ) : null}
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
                      aria-invalid={Boolean(fieldErrors[row.id]?.address) || undefined}
                      aria-describedby={
                        fieldErrors[row.id]?.address ? `send-addr-error-${row.id}` : undefined
                      }
                      className="pr-mono"
                    />
                    <InputGroupAddon>
                      <AddressBookButton
                        address={row.address}
                        onClick={(intent) => openBook(row.address, row.id, intent === "save")}
                        label={`Address book for recipient ${index + 1}`}
                      />
                    </InputGroupAddon>
                  </InputGroup>
                  <FieldError
                    id={`send-addr-error-${row.id}`}
                    message={fieldErrors[row.id]?.address}
                  />
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
                    aria-invalid={Boolean(fieldErrors[row.id]?.amount) || undefined}
                    aria-describedby={
                      fieldErrors[row.id]?.amount ? `send-amt-error-${row.id}` : undefined
                    }
                  />
                  <FieldError
                    id={`send-amt-error-${row.id}`}
                    message={fieldErrors[row.id]?.amount}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
        <label htmlFor="send-recipients-csv" className="sr-only">
          Recipient CSV file
        </label>
        <input
          id="send-recipients-csv"
          ref={csvInputRef}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            void loadCsv(file);
          }}
        />
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="secondary" onClick={() => dispatch({ type: "addRow" })}>
            <Plus className="size-4" strokeWidth={1.5} aria-hidden />
            Add recipient
          </Button>
          <Button type="button" variant="secondary" onClick={() => csvInputRef.current?.click()}>
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
    </>
  );
}
