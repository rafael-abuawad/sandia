"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { appNavItems } from "@/components/app-nav";
import { cn } from "@/lib/utils";

export function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="pr-mobile-tabs fixed inset-x-0 inset-be-0 z-40 border-bs border-border bg-[color-mix(in_oklch,var(--panel-solid)_94%,transparent)] backdrop-blur-md md:hidden"
    >
      <ul className="flex items-stretch gap-0.5 px-1 pbe-[env(safe-area-inset-bottom)] pbs-1">
        {appNavItems.map(({ label, href, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={href} className="min-w-0 flex-1">
              <Link
                href={href}
                data-active={active ? "true" : undefined}
                className={cn(
                  "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1.5 text-xs font-semibold tracking-wide text-muted transition-[color,background-color] duration-[var(--duration)] ease-[var(--ease-out)]",
                  "hover:text-foreground active:bg-foreground/5 active:text-foreground",
                  active && "bg-accent-soft text-accent-foreground",
                )}
              >
                <Icon className="size-5 shrink-0" strokeWidth={1.5} aria-hidden />
                <span className="truncate">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
