import { FieldSkeleton } from "@/components/skeletons/field-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="pr-page" role="status" aria-label="Loading" aria-busy="true">
      <div className="space-y-2">
        <div className="flex flex-wrap items-baseline gap-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-3 w-8" />
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>

      <dl className="grid grid-cols-1 gap-4 border-y border-border py-4 sm:grid-cols-3 sm:gap-3">
        <div className="flex items-baseline justify-between gap-3 sm:block sm:space-y-1">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="flex items-baseline justify-between gap-3 sm:block sm:space-y-1">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="flex items-baseline justify-between gap-3 sm:block sm:space-y-1">
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-4 w-16" />
        </div>
      </dl>

      <div className="space-y-5">
        <FieldSkeleton help />
        <FieldSkeleton help controlClassName="h-14 sm:h-14" />
        <Skeleton className="h-10 w-full" />
      </div>

      <div className="flex items-center gap-2">
        <Skeleton className="size-4 rounded-full" />
        <Skeleton className="h-3 w-48" />
      </div>
    </div>
  );
}
