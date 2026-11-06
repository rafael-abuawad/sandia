"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { BookUser, Plus } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useSignedInWallet } from "@/lib/use-signed-in-wallet";
import { ContactForm } from "@/components/address-book/contact-form";
import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/responsive-dialog";
import { memoError } from "@/lib/stellar/memo";
import { isStellarRecipient } from "@/lib/stellar/strkey";
import { cn, shortenAddress } from "@/lib/utils";
import { userFacingError } from "@/lib/user-facing-error";

type ContactPickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (address: string, memo?: string) => void;
  draftAddress?: string;
  startOnSave?: boolean;
};

export function ContactPicker({
  open,
  onOpenChange,
  onSelect,
  draftAddress,
  startOnSave = false,
}: ContactPickerProps) {
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ContactPickerSession
        open={open}
        onOpenChange={onOpenChange}
        onSelect={onSelect}
        draftAddress={draftAddress}
        startOnSave={startOnSave}
      />
    </ResponsiveDialog>
  );
}

function ContactPickerSession({
  open,
  onOpenChange,
  onSelect,
  draftAddress,
  startOnSave = false,
}: ContactPickerProps) {
  const { isSignedIn } = useSignedInWallet();
  const contacts = useQuery(api.contacts.list, isSignedIn ? {} : "skip");
  const createContact = useMutation(api.contacts.create);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(startOnSave);
  const [name, setName] = useState("");
  const [address, setAddress] = useState(() => draftAddress?.trim() || "");
  const [memo, setMemo] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setShowForm(startOnSave);
    setName("");
    setAddress(draftAddress?.trim() || "");
    setMemo("");
    setError(null);
  }, [open, startOnSave, draftAddress]);

  const sorted = useMemo(() => {
    if (!contacts) return [];
    return [...contacts].sort((a, b) => a.name.localeCompare(b.name));
  }, [contacts]);

  function resetForm() {
    setShowForm(false);
    setName("");
    setAddress("");
    setMemo("");
    setError(null);
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
    const recipient = address.trim();
    const contactMemo = memo.trim();
    if (!isStellarRecipient(recipient)) {
      setError("Enter a valid Stellar address");
      return;
    }
    const memoProblem = memoError(contactMemo);
    if (memoProblem) {
      setError(memoProblem);
      return;
    }
    setSaving(true);
    try {
      await createContact({ name: name.trim(), address: recipient, memo: contactMemo });
      onSelect(recipient, contactMemo);
      onOpenChange(false);
    } catch (err) {
      setError(userFacingError(err, "Unable to save contact."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ResponsiveDialogContent>
      <ResponsiveDialogHeader>
        <ResponsiveDialogTitle>{showForm ? "Add contact" : "Address book"}</ResponsiveDialogTitle>
        <ResponsiveDialogDescription>
          {showForm
            ? "Save a name for this wallet to reuse it later."
            : "Pick a saved recipient or add a new one."}
        </ResponsiveDialogDescription>
      </ResponsiveDialogHeader>
      <ResponsiveDialogBody className="space-y-3">
        {showForm ? (
          <ContactForm
            name={name}
            address={address}
            memo={memo}
            onNameChange={setName}
            onAddressChange={setAddress}
            onMemoChange={setMemo}
            error={error}
            onSubmit={(e) => void onSave(e)}
            saving={saving}
          >
            <Button type="button" variant="outline" onClick={resetForm}>
              Back
            </Button>
          </ContactForm>
        ) : (
          <ContactPickerList
            isSignedIn={isSignedIn}
            contacts={contacts}
            sorted={sorted}
            onSelect={(nextAddress, nextMemo) => {
              onSelect(nextAddress, nextMemo);
              onOpenChange(false);
            }}
          />
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
  );
}

function ContactPickerList({
  isSignedIn,
  contacts,
  sorted,
  onSelect,
}: {
  isSignedIn: boolean;
  contacts: { _id: string; name: string; address: string; memo?: string }[] | undefined;
  sorted: { _id: string; name: string; address: string; memo?: string }[];
  onSelect: (address: string, memo?: string) => void;
}) {
  if (!isSignedIn) {
    return <p className="text-sm text-muted">Sign in to use your address book.</p>;
  }
  if (contacts === undefined) {
    return <p className="text-sm text-muted">Loading contacts…</p>;
  }
  if (sorted.length === 0) {
    return <p className="text-sm text-muted">No saved contacts yet.</p>;
  }

  return (
    <ul className="divide-y divide-border overflow-clip rounded-md border border-border">
      {sorted.map((contact) => (
        <li key={contact._id}>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 px-3 py-3 text-start hover:bg-foreground/[0.03] active:bg-foreground/5"
            aria-label={`Select ${contact.name}, ${shortenAddress(contact.address, 6)}`}
            onClick={() => onSelect(contact.address, contact.memo)}
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
  );
}

export function AddressBookButton({
  onClick,
  label = "Address book",
  address,
}: {
  onClick: (intent: "pick" | "save") => void;
  label?: string;
  address?: string;
}) {
  const { isSignedIn } = useSignedInWallet();
  const contacts = useQuery(api.contacts.list, isSignedIn ? {} : "skip");
  const normalized = address?.trim() ?? "";
  const unregistered = Boolean(
    isSignedIn &&
    normalized &&
    isStellarRecipient(normalized) &&
    contacts &&
    !contacts.some((contact) => contact.address === normalized),
  );

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className="relative"
      aria-label={unregistered ? "Save this address to the address book" : label}
      onClick={() => onClick(unregistered ? "save" : "pick")}
    >
      <BookUser className="size-4" strokeWidth={1.5} />
      {unregistered ? (
        <span
          aria-hidden
          className={cn(
            "absolute inset-bs-1 inset-e-1 size-2 rounded-full bg-logo-cyan",
            "ring-2 ring-panel-elevated",
          )}
        />
      ) : null}
    </Button>
  );
}
