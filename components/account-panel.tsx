"use client";

import { LogOut } from "lucide-react";
import { useId, useRef, useState } from "react";
import { LoginButton } from "@/components/login-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAppAuth } from "@/lib/auth-bridge";
import { UsdgBalanceCard } from "@/components/usdg-balance-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AccountPanelProps = {
  className?: string;
  onAfterLogout?: () => void;
};

export function AccountPanel({ className, onAfterLogout }: AccountPanelProps) {
  const { ready, authenticated, logout } = useAppAuth();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  function confirmLogout() {
    setLogoutError(null);
    dialogRef.current?.showModal();
    cancelRef.current?.focus();
  }

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError(null);
    try {
      await logout();
      dialogRef.current?.close();
      onAfterLogout?.();
    } catch {
      setLogoutError("Could not log out. Please try again.");
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <>
      <div className={cn("space-y-3", className)}>
        <UsdgBalanceCard />
        <div className="space-y-2 border-t border-border pt-3">
          <div className="flex justify-center md:justify-start">
            <LoginButton />
          </div>
          <div className="flex items-center gap-2">
            {ready && authenticated ? (
              <Button
                type="button"
                variant="ghost"
                className="min-w-0 flex-1 justify-center text-muted hover:text-foreground md:justify-start"
                aria-haspopup="dialog"
                onClick={confirmLogout}
              >
                <LogOut className="size-4" strokeWidth={1.5} aria-hidden />
                Logout
              </Button>
            ) : (
              <div className="flex-1" />
            )}
            <ThemeToggle />
          </div>
        </div>
      </div>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-busy={loggingOut}
        className="pr-logout-dialog fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-sm rounded-[var(--radius-xl)] border border-border bg-panel-elevated p-5 text-foreground shadow-md"
        onCancel={(event) => {
          if (loggingOut) event.preventDefault();
        }}
      >
        <div className="space-y-2">
          <h2 id={titleId} className="pr-display text-lg">
            Log out?
          </h2>
          <p id={descriptionId} className="text-sm text-muted">
            You’ll need to sign in again to access your account.
          </p>
          {logoutError ? (
            <p role="alert" className="text-sm text-danger">
              {logoutError}
            </p>
          ) : null}
        </div>
        <div className="mt-5 flex gap-2">
          <Button
            ref={cancelRef}
            type="button"
            variant="secondary"
            className="flex-1"
            disabled={loggingOut}
            onClick={() => dialogRef.current?.close()}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="flex-1"
            disabled={loggingOut}
            onClick={() => void handleLogout()}
          >
            {loggingOut ? "Logging out…" : "Log out"}
          </Button>
        </div>
      </dialog>
    </>
  );
}
