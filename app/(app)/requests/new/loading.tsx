import { FieldSkeleton } from "@/components/skeletons/field-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="pr-page" role="status" aria-label="Loading" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>

      <div className="space-y-5">
        <FieldSkeleton help />
        <FieldSkeleton />
        <FieldSkeleton help controlClassName="h-14 sm:h-14" />
        <FieldSkeleton />
        <FieldSkeleton />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}
