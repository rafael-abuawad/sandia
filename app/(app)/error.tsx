"use client";

import { Button } from "@/components/ui/button";
import { userFacingError } from "@/lib/user-facing-error";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="pr-page pr-page--narrow space-y-3">
      <h1 className="pr-display text-2xl">Something went wrong</h1>
      <p className="text-sm text-muted">
        {userFacingError(error, "This page could not be loaded.")}
      </p>
      <Button type="button" onClick={() => reset()}>
        Try again
      </Button>
    </div>
  );
}
