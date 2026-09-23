"use client";

import { Button } from "@/components/ui/button";

export default function PayError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="space-y-3">
      <h1 className="pr-display text-2xl">Payment page failed</h1>
      <p className="text-sm text-muted">{error.message || "Refresh and try the payment again."}</p>
      <Button type="button" onClick={() => reset()}>
        Try again
      </Button>
    </div>
  );
}
