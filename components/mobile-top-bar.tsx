"use client";

import { useId, useState } from "react";
import { UserRound } from "lucide-react";
import { AccountSheet } from "@/components/account-sheet";
import { AppBrand } from "@/components/app-brand";
import { Button } from "@/components/ui/button";

export function MobileTopBar() {
  const [accountOpen, setAccountOpen] = useState(false);
  const sheetId = useId();

  return (
    <>
      <header className="pr-mobile-top sticky inset-bs-0 z-40 flex min-h-14 items-center justify-between border-be border-border bg-[color-mix(in_oklch,var(--panel-solid)_90%,transparent)] px-4 pbe-0 pbs-[env(safe-area-inset-top)] backdrop-blur-md md:hidden">
        <div className="flex h-14 w-full items-center justify-between">
          <AppBrand />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Open account"
            aria-expanded={accountOpen}
            aria-haspopup="dialog"
            aria-controls={sheetId}
            onClick={() => setAccountOpen(true)}
          >
            <UserRound className="size-5" strokeWidth={1.5} aria-hidden />
          </Button>
        </div>
      </header>
      <AccountSheet id={sheetId} open={accountOpen} onOpenChange={setAccountOpen} />
    </>
  );
}
