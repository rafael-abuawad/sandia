import { QuoteSkeleton } from "@/components/quote-skeleton";
import { FieldSkeleton } from "@/components/skeletons/field-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-8" role="status" aria-label="Loading" aria-busy="true">
      <section className="pr-panel pr-panel--padded space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-9 w-40" />
          </div>
          <Skeleton className="h-5 w-16 rounded-sm" />
        </div>
        <div className="pr-inset flex items-center gap-3 px-3 py-2.5">
          <Skeleton className="size-11 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-40" />
          </div>
        </div>
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
      </section>

      <section className="pr-panel pr-panel--padded space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-10 w-full sm:w-32" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldSkeleton />
          <FieldSkeleton />
        </div>
        <QuoteSkeleton />
        <Skeleton className="h-10 w-full" />
      </section>
    </div>
  );
}
