"use client";

import { usePathname } from "next/navigation";

/**
 * Guest pay pages must not create a Convex user.
 * Wallet ownership is claimed from the account panel, not from a client-supplied address.
 */
export function EnsureConvexUser() {
  const pathname = usePathname();
  if (pathname.startsWith("/pay")) return null;
  return null;
}
