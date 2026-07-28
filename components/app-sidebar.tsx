"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, Handshake, Landmark, LineChart, LogOut } from "lucide-react";
import { ConnectKitButton } from "connectkit";
import { useDisconnect } from "wagmi";
import { useAuth } from "@/components/auth-provider";
import { UsdgBalanceCard } from "@/components/usdg-balance-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  {
    label: "Request",
    href: "/requests/new",
    icon: ArrowDownLeft,
    match: (pathname: string) =>
      pathname.startsWith("/requests") || pathname.startsWith("/dashboard"),
  },
  {
    label: "Send",
    href: "/send",
    icon: ArrowUpRight,
    match: (pathname: string) => pathname.startsWith("/send"),
  },
  {
    label: "OTC",
    href: "/otc",
    icon: Handshake,
    match: (pathname: string) => pathname.startsWith("/otc"),
  },
  {
    label: "Lending",
    href: "/lending",
    icon: Landmark,
    match: (pathname: string) => pathname.startsWith("/lending"),
  },
  {
    label: "Stocks",
    href: "/stocks",
    icon: LineChart,
    match: (pathname: string) => pathname.startsWith("/stocks"),
  },
] as const;

export function AppSidebar() {
  const pathname = usePathname();
  const { signOut } = useAuth();
  const { disconnect } = useDisconnect();

  async function handleLogout() {
    try {
      await signOut();
    } finally {
      disconnect();
    }
  }

  return (
    <aside className="pr-sidebar flex w-full shrink-0 flex-col border-b md:sticky md:top-0 md:h-svh md:w-56 md:self-start md:overflow-y-auto md:border-b-0 md:border-r">
      <div className="flex h-14 items-center px-4 md:h-16">
        <Link href="/" className="pr-brand">
          Payrequest
        </Link>
      </div>

      <nav className="flex flex-1 gap-1 px-2 pb-3 md:flex-col md:px-3 md:pb-4">
        {navItems.map(({ label, href, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <Link
              key={href}
              href={href}
              data-active={active ? "true" : undefined}
              className={cn("pr-nav-item flex-1 justify-center md:flex-none md:justify-start")}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Balance docks above account chrome — always-visible settlement signal */}
      <div className="mt-auto space-y-3 px-3 pb-3 pt-1">
        <UsdgBalanceCard />
        <div className="space-y-2 border-t border-border pt-3">
          <div className="flex justify-center md:justify-start [&_button]:w-full">
            <ConnectKitButton />
          </div>
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-center text-muted hover:text-foreground md:justify-start"
            onClick={handleLogout}
          >
            <LogOut className="size-4" aria-hidden />
            Logout
          </Button>
        </div>
      </div>
    </aside>
  );
}
