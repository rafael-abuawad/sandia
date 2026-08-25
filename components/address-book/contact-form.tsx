"use client";

import { useId, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ContactFormProps = {
  name: string;
  address: string;
  onNameChange: (value: string) => void;
  onAddressChange: (value: string) => void;
  error: string | null;
  onSubmit: (e: React.FormEvent) => void;
  saving: boolean;
  submitLabel?: string;
  children?: ReactNode;
};

export function ContactForm({
  name,
  address,
  onNameChange,
  onAddressChange,
  error,
  onSubmit,
  saving,
  submitLabel = "Save contact",
  children,
}: ContactFormProps) {
  const id = useId();
  const nameId = `${id}-name`;
  const addressId = `${id}-address`;
  const errorId = `${id}-error`;

  return (
    <form className="space-y-3" onSubmit={onSubmit} noValidate>
      <div className="space-y-2">
        <Label htmlFor={nameId}>Name</Label>
        <Input
          id={nameId}
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Alex"
          autoComplete="off"
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? errorId : undefined}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={addressId}>Wallet</Label>
        <Input
          id={addressId}
          value={address}
          onChange={(e) => onAddressChange(e.target.value)}
          placeholder="0x…"
          autoComplete="off"
          className="pr-mono"
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? errorId : undefined}
        />
      </div>
      <FieldError id={errorId} message={error} />
      <div className="flex gap-2">
        <Button type="submit" className="flex-1" disabled={saving}>
          {saving ? "Saving…" : submitLabel}
        </Button>
        {children}
      </div>
    </form>
  );
}
