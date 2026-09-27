"use client";

import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="pr-page pr-page--measure" role="status" aria-label="Loading" aria-busy="true">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="mt-1 h-4 w-52" />
        </div>
        <Skeleton className="h-5 w-16 rounded-sm" />
      </div>

      <div className="pr-panel pr-panel--padded space-y-3">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-4 w-full" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-28" />
        </div>
      </div>

      <div className="space-y-2">
        <Skeleton className="h-4 w-36" />
        <div className="pr-inset flex items-center justify-between gap-3 px-3 py-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-5 w-16 rounded-sm" />
        </div>
        <div className="pr-inset flex items-center justify-between gap-3 px-3 py-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-5 w-16 rounded-sm" />
        </div>
      </div>
    </div>
  );
}
