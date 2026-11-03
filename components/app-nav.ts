import {
  ArrowDownLeft,
  ArrowUpRight,
  BrainCircuit,
  CandlestickChart,
  History,
  type LucideIcon,
} from "lucide-react";

export type AppNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  match: (pathname: string) => boolean;
};

export const appNavItems: AppNavItem[] = [
  {
    label: "Trade",
    href: "/trade",
    icon: CandlestickChart,
    match: (pathname) => pathname === "/" || pathname.startsWith("/trade"),
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
  {
    label: "Activity",
    href: "/activity",
    icon: History,
    match: (pathname) => pathname.startsWith("/activity"),
  },
  {
    label: "AI",
    href: "/agent",
    icon: BrainCircuit,
    match: (pathname) => pathname.startsWith("/agent"),
  },
];
