"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { BookUser, Plus } from "lucide-react";
import { isAddress } from "viem";
import { api } from "@/convex/_generated/api";
import { useSignedInWallet } from "@/lib/use-signed-in-wallet";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/responsive-dialog";
import { shortenAddress } from "@/lib/utils";

type ContactPickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (address: string) => void;
  draftAddress?: string;
};

export function ContactPicker({ open, onOpenChange, onSelect, draftAddress }: ContactPickerProps) {
  const { isSignedIn } = useSignedInWallet();
  const contacts = useQuery(api.contacts.list, isSignedIn ? {} : "skip");
  const createContact = useMutation(api.contacts.create);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);

  const sorted = useMemo(() => {
    if (!contacts) return [];
    return [...contacts].sort((a, b) => a.name.localeCompare(b.name));
  }, [contacts]);

  function resetForm() {
    setShowForm(false);
    setName("");
    setAddress("");
    setError(null);
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetForm();
    onOpenChange(next);
  }

  function startSave() {
    setShowForm(true);
    setError(null);
    setAddress(draftAddress?.trim() || "");
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Enter a name");
      return;
    }
    if (!isAddress(address)) {
      setError("Enter a valid wallet address");
      return;
    }
    setSaving(true);
    try {
      await createContact({ name: name.trim(), address });
      onSelect(address);
      handleOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save contact.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={handleOpenChange}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Address book</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Pick a saved recipient or add a new one.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <ResponsiveDialogBody className="space-y-3">
          {showForm ? (
            <form className="space-y-3" onSubmit={(e) => void onSave(e)}>
              <div className="space-y-2">
                <Label htmlFor="contact-name">Name</Label>
                <Input
                  id="contact-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alex"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-address">Wallet</Label>
                <Input
                  id="contact-address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="0x…"
                  autoComplete="off"
                  className="pr-mono"
                />
              </div>
              <FieldError id="contact-error" message={error} />
              <div className="flex gap-2">
                <Button type="submit" className="flex-1" disabled={saving}>
                  {saving ? "Saving…" : "Save contact"}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Back
                </Button>
              </div>
            </form>
          ) : (
            <>
              {!isSignedIn ? (
                <p className="text-sm text-muted">Sign in to use your address book.</p>
              ) : contacts === undefined ? (
                <p className="text-sm text-muted">Loading contacts…</p>
              ) : sorted.length === 0 ? (
                <p className="text-sm text-muted">No saved contacts yet.</p>
              ) : (
                <ul className="divide-y divide-border overflow-hidden rounded-md border border-border">
                  {sorted.map((contact) => (
                    <li key={contact._id}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left hover:bg-foreground/[0.03]"
                        aria-label={`Select ${contact.name}, ${shortenAddress(contact.address, 6)}`}
                        onClick={() => {
                          onSelect(contact.address);
                          handleOpenChange(false);
                        }}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-foreground">
                            {contact.name}
                          </span>
                          <span className="pr-mono block text-xs text-muted">
                            {shortenAddress(contact.address, 6)}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </ResponsiveDialogBody>
        {!showForm ? (
          <ResponsiveDialogFooter>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              disabled={!isSignedIn}
              onClick={startSave}
            >
              <Plus className="size-4" strokeWidth={1.5} aria-hidden />
              Add contact
            </Button>
          </ResponsiveDialogFooter>
        ) : null}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

export function AddressBookButton({
  onClick,
  label = "Address book",
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <Button type="button" variant="ghost" size="icon-sm" aria-label={label} onClick={onClick}>
      <BookUser className="size-4" strokeWidth={1.5} />
    </Button>
  );
}
