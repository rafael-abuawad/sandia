import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Page not found",
  description: "That address is not a Sandia page.",
  index: false,
});

export default function NotFound() {
  return (
    <main id="main" tabIndex={-1} className="pr-shell mx-auto flex w-full max-w-xl flex-1 flex-col gap-3 py-16">
      <h1 className="pr-display text-3xl">Page not found</h1>
      <p className="text-muted">That address is not a Sandia page.</p>
      <Link href="/" className="text-sm underline underline-offset-2">
        Back to Sandia
      </Link>
    </main>
  );
}
