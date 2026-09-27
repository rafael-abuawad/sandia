"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function ActivityListSkeleton() {
  return (
    <ul className="space-y-2" role="status" aria-label="Loading" aria-busy="true">
      {["a", "b", "c"].map((row) => (
        <li key={row} className="pr-panel flex items-center justify-between gap-3 px-4 py-3">
          <div className="space-y-1">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-3 w-40" />
          </div>
          <Skeleton className="h-5 w-16 rounded-sm" />
        </li>
      ))}
    </ul>
  );
}

export default function ActivityLoading() {
  return (
    <div className="pr-page pr-page--wide space-y-4">
      <Skeleton className="h-8 w-32" />
      <ActivityListSkeleton />
    </div>
  );
}
