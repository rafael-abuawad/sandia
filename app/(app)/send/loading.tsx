import { FieldSkeleton } from "@/components/skeletons/field-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="pr-page" role="status" aria-label="Loading" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
          <Skeleton className="h-3 w-2/3" />
        </div>
        <FieldSkeleton help controlClassName="h-14 sm:h-14" />
        <FieldSkeleton />
        <FieldSkeleton />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}
