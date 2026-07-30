"use client";

import { useState } from "react";
import Link from "next/link";
import { UserRound } from "lucide-react";
import { AccountSheet } from "@/components/account-sheet";
import { Button } from "@/components/ui/button";

export function MobileTopBar() {
  const [accountOpen, setAccountOpen] = useState(false);

  return (
    <>
      <header className="pr-mobile-top sticky top-0 z-40 flex min-h-14 items-center justify-between border-b border-border bg-[color-mix(in_srgb,var(--panel-solid)_90%,transparent)] px-4 pb-0 pt-[env(safe-area-inset-top)] backdrop-blur-md md:hidden">
        <div className="flex h-14 w-full items-center justify-between">
          <Link href="/" className="pr-brand">
            Payrequest
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Open account"
            aria-expanded={accountOpen}
            onClick={() => setAccountOpen(true)}
          >
            <UserRound className="size-5" aria-hidden />
          </Button>
        </div>
      </header>
      <AccountSheet open={accountOpen} onOpenChange={setAccountOpen} />
    </>
  );
}
