import { ArrowDownLeft, ArrowUpRight, BrainCircuit, type LucideIcon } from "lucide-react";

export type AppNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  match: (pathname: string) => boolean;
};

export const appNavItems: AppNavItem[] = [
  {
    label: "AI Agent",
    href: "/agent",
    icon: BrainCircuit,
    match: (pathname) => pathname.startsWith("/agent"),
  },
  {
    label: "Request",
    href: "/requests/new",
    icon: ArrowDownLeft,
    match: (pathname) => pathname.startsWith("/requests") || pathname.startsWith("/dashboard"),
  },
  {
    label: "Send",
    href: "/send",
    icon: ArrowUpRight,
    match: (pathname) => pathname.startsWith("/send"),
  },
];
