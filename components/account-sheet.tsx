"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { AccountPanel } from "@/components/account-panel";
import { Button } from "@/components/ui/button";

type AccountSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  id?: string;
};

export function AccountSheet({ open, onOpenChange, id }: AccountSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const generatedTitleId = useId();
  const titleId = generatedTitleId;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      id={id}
      aria-labelledby={titleId}
      className="pr-account-sheet fixed inset-x-0 bottom-0 m-0 mt-auto w-full max-w-none rounded-t-[var(--radius-xl)] border border-border bg-panel-elevated p-0 text-foreground shadow-md open:flex open:flex-col"
      onClose={() => onOpenChange(false)}
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 id={titleId} className="pr-section-title">
          Account
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Close account"
          onClick={() => onOpenChange(false)}
        >
          <X className="size-4" strokeWidth={1.5} aria-hidden />
        </Button>
      </div>
      <div className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
        <AccountPanel onAfterLogout={() => onOpenChange(false)} />
      </div>
    </dialog>
  );
}
