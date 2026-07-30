import {
  ArrowDownLeft,
  ArrowUpRight,
  Handshake,
  Landmark,
  LineChart,
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
    label: "OTC",
    href: "/otc",
    icon: Handshake,
    match: (pathname) => pathname.startsWith("/otc"),
  },
  {
    label: "Lending",
    href: "/lending",
    icon: Landmark,
    match: (pathname) => pathname.startsWith("/lending"),
  },
  {
    label: "Stocks",
    href: "/stocks",
    icon: LineChart,
    match: (pathname) => pathname.startsWith("/stocks"),
  },
];
