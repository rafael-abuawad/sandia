"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookUser, History } from "lucide-react";
import { AccountPanel } from "@/components/account-panel";
import { AppBrand } from "@/components/app-brand";
import { appNavItems } from "@/components/app-nav";
import { cn } from "@/lib/utils";

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="pr-sidebar hidden w-56 shrink-0 flex-col border-e md:sticky md:inset-bs-0 md:flex md:h-svh md:self-start md:overflow-y-auto">
      <div className="flex h-16 items-center px-4">
        <AppBrand />
      </div>

      <nav aria-label="Primary" className="flex flex-1 flex-col gap-1 px-3 pbe-4">
        {appNavItems.map(({ label, href, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <Link
              key={href}
              href={href}
              data-active={active ? "true" : undefined}
              className={cn("pr-nav-item justify-start")}
            >
              <Icon className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />
              <span>{label}</span>
            </Link>
          );
        })}
        <Link
          href="/address-book"
          data-active={pathname.startsWith("/address-book") ? "true" : undefined}
          className={cn("pr-nav-item justify-start")}
        >
          <BookUser className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />
          <span>Address book</span>
        </Link>
        <Link
          href="/activity"
          data-active={pathname.startsWith("/activity") ? "true" : undefined}
          className={cn("pr-nav-item justify-start")}
        >
          <History className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />
          <span>Activity</span>
        </Link>
      </nav>

      <div className="mbs-auto px-3 pbe-3 pbs-1">
        <AccountPanel />
      </div>
    </aside>
  );
}
