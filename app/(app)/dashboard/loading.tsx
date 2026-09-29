"use client";

import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="pr-page pr-page--wide" role="status" aria-label="Loading" aria-busy="true">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-10 w-full sm:w-32" />
      </div>

      <ul className="space-y-3">
        <li className="pr-panel flex items-center justify-between gap-4 px-4 py-4">
          <div className="min-w-0 space-y-1">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-52" />
          </div>
          <Skeleton className="h-5 w-16 rounded-sm" />
        </li>
        <li className="pr-panel flex items-center justify-between gap-4 px-4 py-4">
          <div className="min-w-0 space-y-1">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-5 w-16 rounded-sm" />
        </li>
        <li className="pr-panel flex items-center justify-between gap-4 px-4 py-4">
          <div className="min-w-0 space-y-1">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-3 w-44" />
          </div>
          <Skeleton className="h-5 w-16 rounded-sm" />
        </li>
      </ul>
    </div>
  );
}
