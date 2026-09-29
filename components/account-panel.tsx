"use client";

import { LogOut } from "lucide-react";
import { LoginButton } from "@/components/login-button";
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

  async function handleLogout() {
    try {
      await logout();
    } finally {
      onAfterLogout?.();
    }
  }

  return (
    <div className={cn("space-y-3", className)}>
      <UsdgBalanceCard />
      <div className="space-y-2 border-t border-border pt-3">
        <div className="flex justify-center md:justify-start">
          <LoginButton />
        </div>
        {ready && authenticated ? (
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-center text-muted hover:text-foreground md:justify-start"
            onClick={() => void handleLogout()}
          >
            <LogOut className="size-4" strokeWidth={1.5} aria-hidden />
            Logout
          </Button>
        ) : null}
      </div>
    </div>
  );
}
