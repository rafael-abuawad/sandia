import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="pr-page" role="status" aria-label="Loading" aria-busy="true">
      <Skeleton className="h-4 w-28" />

      <div className="flex items-start gap-3">
        <Skeleton className="size-12 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-1">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="ml-auto h-5 w-14 rounded-sm" />
      </div>

      <dl className="grid grid-cols-2 gap-4 border-y border-border py-4 sm:grid-cols-4">
        <div className="space-y-1">
          <Skeleton className="h-3 w-8" />
          <Skeleton className="h-6 w-20" />
        </div>
        <div className="space-y-1">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-5 w-28" />
        </div>
        <div className="space-y-1">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-5 w-16" />
        </div>
        <div className="space-y-1">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-5 w-20" />
        </div>
      </dl>

      <Skeleton className="h-3 w-48" />

      <div className="space-y-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-40" />
      </div>

      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>

      <Skeleton className="h-12 w-full" />
    </div>
  );
}
