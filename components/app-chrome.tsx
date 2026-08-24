"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { MobileTabBar } from "@/components/mobile-tab-bar";
import { MobileTopBar } from "@/components/mobile-top-bar";

export function AppChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row md:items-start">
      <MobileTopBar />
      <AppSidebar />
      <main
        id="main"
        tabIndex={-1}
        className="pr-shell min-w-0 flex-1 py-8 pb-[calc(4.5rem+env(safe-area-inset-bottom))] sm:py-10 md:pb-10"
      >
        {children}
      </main>
      <MobileTabBar />
    </div>
  );
}
