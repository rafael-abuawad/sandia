"use client";

import { LogOut } from "lucide-react";
import { ConnectKitButton } from "connectkit";
import { useDisconnect } from "wagmi";
import { useAuth } from "@/components/auth-provider";
import { UsdgBalanceCard } from "@/components/usdg-balance-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AccountPanelProps = {
  className?: string;
  onAfterLogout?: () => void;
};

export function AccountPanel({ className, onAfterLogout }: AccountPanelProps) {
  const { signOut } = useAuth();
  const { disconnect } = useDisconnect();

  async function handleLogout() {
    try {
      await signOut();
    } finally {
      disconnect();
      onAfterLogout?.();
    }
  }

  return (
    <div className={cn("space-y-3", className)}>
      <UsdgBalanceCard />
      <div className="space-y-2 border-t border-border pt-3">
        <div className="flex justify-center [&_button]:w-full md:justify-start">
          <ConnectKitButton />
        </div>
        <Button
          type="button"
          variant="ghost"
          className="w-full justify-center text-muted hover:text-foreground md:justify-start"
          onClick={() => void handleLogout()}
        >
          <LogOut className="size-4" aria-hidden />
          Logout
        </Button>
      </div>
    </div>
  );
}
