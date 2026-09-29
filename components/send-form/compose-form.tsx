"use client";

import { useEffect, useId, useRef, useState } from "react";
import { LoginButton } from "@/components/login-button";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Label } from "@/components/ui/label";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { AmountCompose } from "@/components/amount-compose";
import { AddressBookButton, ContactPicker } from "@/components/address-book/contact-picker";
import { cn } from "@/lib/utils";
import { MassiveSendFields } from "@/components/send-form/massive-fields";
import type { RecipientRow, SendFormAction, SendMode } from "@/components/send-form/state";
import type { SendFieldErrors } from "@/components/send-form/helpers";

type SendComposeFormProps = {
  mode: SendMode;
  singleAddress: string;
  singleAmount: string;
  rows: RecipientRow[];
  liveTotalLabel: string | null;
  error: string | null;
  fieldErrors: SendFieldErrors;
  isConnected: boolean;
  balanceMessage: string | null;
  balanceIsError: boolean;
  balanceInsufficient: boolean;
  onRetryBalance: () => void;
  validationAttempt: number;
  dispatch: React.Dispatch<SendFormAction>;
  onSubmit: (e: React.FormEvent) => void;
};

function focusFirstInvalidField(fieldErrors: SendFieldErrors) {
  const firstInvalid = Object.entries(fieldErrors).find(
    ([, fields]) => fields.address || fields.amount,
  );
  if (!firstInvalid) return false;

  const [key, fields] = firstInvalid;
  const id =
    key === "single"
      ? fields.address
        ? "send-recipient"
        : "send-amount"
      : `${fields.address ? "send-addr" : "send-amt"}-${key}`;
  document.getElementById(id)?.focus();
  return true;
}

function SendComposeFooter({
  isConnected,
  balanceInsufficient,
}: {
  isConnected: boolean;
  balanceInsufficient: boolean;
}) {
  if (!isConnected) {
    return (
      <div className="flex flex-col items-center gap-3">
        <LoginButton />
        <p className="text-center text-sm text-muted">Sign in to send USDG.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Button type="submit" className="w-full" size="lg" disabled={balanceInsufficient}>
        Review send
      </Button>
      {balanceInsufficient ? (
        <p className="text-center text-sm text-danger" role="status" aria-live="polite">
          This send exceeds your balance
        </p>
      ) : null}
    </div>
  );
}

export function SendComposeForm({
  mode,
  singleAddress,
  singleAmount,
  rows,
  liveTotalLabel,
  error,
  fieldErrors,
  isConnected,
  balanceMessage,
  balanceIsError,
  balanceInsufficient,
  onRetryBalance,
  validationAttempt,
  dispatch,
  onSubmit,
}: SendComposeFormProps) {
  const lastFocusedValidationAttempt = useRef(0);
  const errorId = useId();
  const singleAddressErrorId = useId();
  const singleAmountErrorId = useId();
  const [bookOpen, setBookOpen] = useState(false);
  const bookRowIdRef = useRef<string | null>(null);
  const [bookDraft, setBookDraft] = useState("");
  const [bookStartOnSave, setBookStartOnSave] = useState(false);

  useEffect(() => {
    if (validationAttempt !== lastFocusedValidationAttempt.current) {
      lastFocusedValidationAttempt.current = validationAttempt;
      if (focusFirstInvalidField(fieldErrors)) return;
    }
    if (!error) return;
    const firstRecipientId = rows[0]?.id;
    document
      .getElementById(mode === "single" ? "send-recipient" : `send-addr-${firstRecipientId}`)
      ?.focus();
  }, [error, fieldErrors, mode, rows, validationAttempt]);

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

  const footer = (
    <SendComposeFooter isConnected={isConnected} balanceInsufficient={balanceInsufficient} />
  );

  function openBook(draft: string, rowId: string | null = null, startOnSave = false) {
    setBookDraft(draft);
    bookRowIdRef.current = rowId;
    setBookStartOnSave(startOnSave);
    setBookOpen(true);
  }

  function onPickAddress(address: string) {
    if (bookRowIdRef.current) {
      dispatch({ type: "updateRow", id: bookRowIdRef.current, patch: { address } });
      return;
    }
    dispatch({ type: "setSingleAddress", address });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3" noValidate>
      {modeToggle}
      {balanceMessage ? (
        <div className="flex items-center justify-between gap-3 text-sm" role="status">
          <p className={balanceIsError ? "text-danger" : "text-muted"}>{balanceMessage}</p>
          {balanceIsError ? (
            <Button type="button" variant="outline" size="sm" onClick={onRetryBalance}>
              Retry
            </Button>
          ) : null}
        </div>
      ) : null}
      {mode === "single" ? (
        <AmountCompose
          kicker="You're sending"
          prefix="$"
          suffix="USDG"
          value={singleAmount}
          onChange={(amount) => dispatch({ type: "setSingleAmount", amount })}
          footer={footer}
          inputId="send-amount"
          invalid={Boolean(fieldErrors.single?.amount)}
          errorId={singleAmountErrorId}
          error={<FieldError id={singleAmountErrorId} message={fieldErrors.single?.amount} />}
        >
          <div className="space-y-2">
            <Label htmlFor="send-recipient">To</Label>
            <InputGroup>
              <InputGroupInput
                id="send-recipient"
                value={singleAddress}
                onChange={(e) => dispatch({ type: "setSingleAddress", address: e.target.value })}
                placeholder="0x… or pick from address book"
                required
                aria-invalid={Boolean(fieldErrors.single?.address) || undefined}
                aria-describedby={fieldErrors.single?.address ? singleAddressErrorId : undefined}
                className="pr-mono"
              />
              <InputGroupAddon>
                <AddressBookButton
                  address={singleAddress}
                  onClick={(intent) => openBook(singleAddress, null, intent === "save")}
                />
              </InputGroupAddon>
            </InputGroup>
            <FieldError id={singleAddressErrorId} message={fieldErrors.single?.address} />
          </div>
          <FieldError id={errorId} message={error} />
        </AmountCompose>
      ) : (
        <>
          <MassiveSendFields
            rows={rows}
            fieldErrors={fieldErrors}
            liveTotalLabel={liveTotalLabel}
            dispatch={dispatch}
            openBook={openBook}
          />
          <FieldError id={errorId} message={error} />
          <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 -mx-1 bg-[color-mix(in_srgb,var(--background)_92%,transparent)] px-1 py-3 backdrop-blur-sm md:static md:bottom-auto md:bg-transparent md:p-0 md:backdrop-blur-none">
            {footer}
          </div>
        </>
      )}

      <ContactPicker
        open={bookOpen}
        onOpenChange={(open) => {
          setBookOpen(open);
          if (!open) setBookStartOnSave(false);
        }}
        onSelect={onPickAddress}
        draftAddress={bookDraft}
        startOnSave={bookStartOnSave}
      />
    </form>
  );
}
