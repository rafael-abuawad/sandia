import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Compact skeleton matching the above-the-fold “You send” quote row. */
export function QuoteSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("pr-inset flex items-center justify-between px-4 py-3", className)}
      aria-busy="true"
      aria-label="Loading quote"
    >
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-4 w-28" />
    </div>
  );
}
