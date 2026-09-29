import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div
      className="pr-stack pr-page--hero mx-auto"
      role="status"
      aria-label="Loading"
      aria-busy="true"
    >
      <section className="pr-panel pr-panel--hero">
        <div className="relative max-w-2xl space-y-6">
          <Skeleton className="h-3 w-24" />
          <div className="space-y-3">
            <Skeleton className="h-9 w-full sm:h-12" />
            <Skeleton className="h-9 w-5/6 sm:h-12" />
            <Skeleton className="h-9 w-3/4 sm:h-12" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
          <div className="flex flex-wrap gap-3 pt-2">
            <Skeleton className="h-12 w-40" />
            <Skeleton className="h-12 w-32" />
            <Skeleton className="h-12 w-36" />
          </div>
        </div>
      </section>

      <section className="pr-grid-3">
        <div className="pr-feature space-y-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <div className="pr-feature space-y-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <div className="pr-feature space-y-2">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </section>
    </div>
  );
}
