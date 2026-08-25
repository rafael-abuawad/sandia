"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { BookUser, Plus } from "lucide-react";
import { isAddress } from "viem";
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
import { cn, shortenAddress } from "@/lib/utils";

type ContactPickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (address: string) => void;
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
  const { isSignedIn } = useSignedInWallet();
  const contacts = useQuery(api.contacts.list, isSignedIn ? {} : "skip");
  const createContact = useMutation(api.contacts.create);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const wasOpen = useRef(false);

  const sorted = useMemo(() => {
    if (!contacts) return [];
    return [...contacts].sort((a, b) => a.name.localeCompare(b.name));
  }, [contacts]);

  useEffect(() => {
    if (open && !wasOpen.current) {
      if (startOnSave) {
        setShowForm(true);
        setName("");
        setAddress(draftAddress?.trim() || "");
        setError(null);
      }
    }
    if (!open && wasOpen.current) {
      setShowForm(false);
      setName("");
      setAddress("");
      setError(null);
      setSaving(false);
    }
    wasOpen.current = open;
  }, [open, startOnSave, draftAddress]);

  function resetForm() {
    setShowForm(false);
    setName("");
    setAddress("");
    setError(null);
  }

  function handleOpenChange(next: boolean) {
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
              onNameChange={setName}
              onAddressChange={setAddress}
              error={error}
              onSubmit={(e) => void onSave(e)}
              saving={saving}
            >
              <Button type="button" variant="outline" onClick={resetForm}>
                Back
              </Button>
            </ContactForm>
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
  address,
}: {
  onClick: (intent: "pick" | "save") => void;
  label?: string;
  address?: string;
}) {
  const { isSignedIn } = useSignedInWallet();
  const contacts = useQuery(api.contacts.list, isSignedIn ? {} : "skip");
  const normalized = address?.trim().toLowerCase() ?? "";
  const unregistered = Boolean(
    isSignedIn &&
      address &&
      isAddress(address) &&
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
            "absolute top-1 right-1 size-2 rounded-full bg-logo-cyan",
            "ring-2 ring-panel-elevated",
          )}
        />
      ) : null}
    </Button>
  );
}
