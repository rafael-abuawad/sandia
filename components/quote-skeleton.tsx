import { cn } from "@/lib/utils";

function Bone({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block animate-pulse rounded bg-foreground/10 motion-reduce:animate-none",
        className,
      )}
    />
  );
}

/** Compact skeleton matching the above-the-fold “You send” quote row. */
export function QuoteSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("pr-inset flex items-center justify-between px-4 py-3", className)}
      aria-busy="true"
      aria-label="Loading quote"
    >
      <Bone className="h-4 w-24" />
      <Bone className="h-4 w-28" />
    </div>
  );
}
