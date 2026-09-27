"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { isAddress } from "viem";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { useSignedInWallet } from "@/lib/use-signed-in-wallet";
import { ContactForm } from "@/components/address-book/contact-form";
import { LoginButton } from "@/components/login-button";
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
import { shortenAddress } from "@/lib/utils";
import { userFacingError } from "@/lib/user-facing-error";

type Editor =
  | { mode: "create" }
  | { mode: "edit"; contact: Doc<"contacts"> }
  | { mode: "delete"; contact: Doc<"contacts"> };

function useAddressBookEditor() {
  const createContact = useMutation(api.contacts.create);
  const updateContact = useMutation(api.contacts.update);
  const removeContact = useMutation(api.contacts.remove);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function closeEditor() {
    setEditor(null);
    setName("");
    setAddress("");
    setError(null);
    setSaving(false);
  }

  function startCreate() {
    setName("");
    setAddress("");
    setError(null);
    setEditor({ mode: "create" });
  }

  function startEdit(contact: Doc<"contacts">) {
    setName(contact.name);
    setAddress(contact.address);
    setError(null);
    setEditor({ mode: "edit", contact });
  }

  function startDelete(contact: Doc<"contacts">) {
    setError(null);
    setEditor({ mode: "delete", contact });
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editor || editor.mode === "delete") return;
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
      if (editor.mode === "create") {
        await createContact({ name: name.trim(), address });
      } else {
        await updateContact({
          contactId: editor.contact._id,
          name: name.trim(),
          address,
        });
      }
      closeEditor();
    } catch (err) {
      setError(userFacingError(err, "Unable to save contact."));
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!editor || editor.mode !== "delete") return;
    setSaving(true);
    setError(null);
    try {
      await removeContact({ contactId: editor.contact._id });
      closeEditor();
    } catch (err) {
      setError(userFacingError(err, "Unable to delete contact."));
    } finally {
      setSaving(false);
    }
  }

  return {
    editor,
    name,
    address,
    error,
    saving,
    setName,
    setAddress,
    closeEditor,
    startCreate,
    startEdit,
    startDelete,
    onSave,
    onDelete,
  };
}

export function AddressBookPage() {
  const { ready, isSignedIn } = useSignedInWallet();
  const contacts = useQuery(api.contacts.list, isSignedIn ? {} : "skip");
  const editor = useAddressBookEditor();

  const sorted = useMemo(() => {
    if (!contacts) return [];
    return [...contacts].sort((a, b) => a.name.localeCompare(b.name));
  }, [contacts]);

  return (
    <div className="pr-page">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <h1 className="pr-display text-2xl">Address book</h1>
          <p className="text-sm leading-relaxed text-muted">
            Save recipient wallets you use often, then pick them from any send field.
          </p>
        </div>
        {isSignedIn ? (
          <Button type="button" onClick={editor.startCreate}>
            <Plus className="size-4" strokeWidth={1.5} aria-hidden />
            Add contact
          </Button>
        ) : null}
      </div>

      <AddressBookContacts
        ready={ready}
        isSignedIn={isSignedIn}
        contacts={contacts}
        sorted={sorted}
        onEdit={editor.startEdit}
        onDelete={editor.startDelete}
      />

      <AddressBookEditorDialog
        editor={editor.editor}
        name={editor.name}
        address={editor.address}
        error={editor.error}
        saving={editor.saving}
        onNameChange={editor.setName}
        onAddressChange={editor.setAddress}
        onClose={editor.closeEditor}
        onSave={editor.onSave}
        onDelete={editor.onDelete}
      />
    </div>
  );
}

function AddressBookContacts({
  ready,
  isSignedIn,
  contacts,
  sorted,
  onEdit,
  onDelete,
}: {
  ready: boolean;
  isSignedIn: boolean;
  contacts: Doc<"contacts">[] | undefined;
  sorted: Doc<"contacts">[];
  onEdit: (contact: Doc<"contacts">) => void;
  onDelete: (contact: Doc<"contacts">) => void;
}) {
  if (!ready || (isSignedIn && contacts === undefined)) {
    return (
      <div
        className="overflow-hidden rounded-md border border-border"
        role="status"
        aria-label="Loading"
        aria-busy="true"
      >
        {["a", "b", "c"].map((row) => (
          <div
            key={row}
            className="flex items-center gap-3 border-b border-border px-3 py-3 last:border-b-0"
          >
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="pr-panel pr-panel--padded space-y-4">
        <p className="text-sm text-muted">Sign in to view and edit your address book.</p>
        <LoginButton />
      </div>
    );
  }

  if (sorted.length === 0) {
    return (
      <div className="pr-panel pr-panel--padded space-y-3">
        <p className="font-medium text-foreground">No saved contacts yet</p>
        <p className="text-sm text-muted">Add a name and wallet to fill send fields in one tap.</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-md border border-border bg-panel-elevated">
      {sorted.map((contact) => (
        <li key={contact._id} className="flex items-center gap-3 px-3 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{contact.name}</p>
            <p className="pr-mono truncate text-xs text-muted">
              {shortenAddress(contact.address, 6)}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Edit ${contact.name}`}
            onClick={() => onEdit(contact)}
          >
            <Pencil className="size-4" strokeWidth={1.5} aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-muted hover:text-danger"
            aria-label={`Delete ${contact.name}`}
            onClick={() => onDelete(contact)}
          >
            <Trash2 className="size-4" strokeWidth={1.5} aria-hidden />
          </Button>
        </li>
      ))}
    </ul>
  );
}

function AddressBookEditorDialog({
  editor,
  name,
  address,
  error,
  saving,
  onNameChange,
  onAddressChange,
  onClose,
  onSave,
  onDelete,
}: {
  editor: Editor | null;
  name: string;
  address: string;
  error: string | null;
  saving: boolean;
  onNameChange: (value: string) => void;
  onAddressChange: (value: string) => void;
  onClose: () => void;
  onSave: (e: React.FormEvent) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  return (
    <ResponsiveDialog open={editor !== null} onOpenChange={(open) => !open && onClose()}>
      <ResponsiveDialogContent>
        {editor?.mode === "delete" ? (
          <DeleteContactDialog
            contact={editor.contact}
            error={error}
            saving={saving}
            onClose={onClose}
            onDelete={onDelete}
          />
        ) : (
          <SaveContactDialog
            mode={editor?.mode === "edit" ? "edit" : "create"}
            name={name}
            address={address}
            error={error}
            saving={saving}
            onNameChange={onNameChange}
            onAddressChange={onAddressChange}
            onClose={onClose}
            onSave={onSave}
          />
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

function DeleteContactDialog({
  contact,
  error,
  saving,
  onClose,
  onDelete,
}: {
  contact: Doc<"contacts">;
  error: string | null;
  saving: boolean;
  onClose: () => void;
  onDelete: () => Promise<void>;
}) {
  return (
    <>
      <ResponsiveDialogHeader>
        <ResponsiveDialogTitle>Delete contact</ResponsiveDialogTitle>
        <ResponsiveDialogDescription>
          Remove {contact.name} ({shortenAddress(contact.address, 6)}) from your address book.
        </ResponsiveDialogDescription>
      </ResponsiveDialogHeader>
      <ResponsiveDialogBody>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
      </ResponsiveDialogBody>
      <ResponsiveDialogFooter className="gap-2">
        <Button
          type="button"
          variant="destructive"
          disabled={saving}
          onClick={() => void onDelete()}
        >
          {saving ? "Deleting…" : "Delete"}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </ResponsiveDialogFooter>
    </>
  );
}

function SaveContactDialog({
  mode,
  name,
  address,
  error,
  saving,
  onNameChange,
  onAddressChange,
  onClose,
  onSave,
}: {
  mode: "create" | "edit";
  name: string;
  address: string;
  error: string | null;
  saving: boolean;
  onNameChange: (value: string) => void;
  onAddressChange: (value: string) => void;
  onClose: () => void;
  onSave: (e: React.FormEvent) => Promise<void>;
}) {
  return (
    <>
      <ResponsiveDialogHeader>
        <ResponsiveDialogTitle>
          {mode === "edit" ? "Edit contact" : "Add contact"}
        </ResponsiveDialogTitle>
        <ResponsiveDialogDescription>
          {mode === "edit"
            ? "Update the name or wallet for this recipient."
            : "Save a name and wallet to reuse on send."}
        </ResponsiveDialogDescription>
      </ResponsiveDialogHeader>
      <ResponsiveDialogBody>
        <ContactForm
          name={name}
          address={address}
          onNameChange={onNameChange}
          onAddressChange={onAddressChange}
          error={error}
          onSubmit={(e) => void onSave(e)}
          saving={saving}
          submitLabel={mode === "edit" ? "Save changes" : "Save contact"}
        >
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </ContactForm>
      </ResponsiveDialogBody>
    </>
  );
}
