import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="pr-page" role="status" aria-label="Loading" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <div className="overflow-hidden rounded-md border border-border">
        {["a", "b", "c"].map((row) => (
          <div key={row} className="flex items-center gap-3 border-b border-border px-3 py-3 last:border-b-0">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-40" />
            </div>
            <Skeleton className="size-8 rounded-md" />
            <Skeleton className="size-8 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
