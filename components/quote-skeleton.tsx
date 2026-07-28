import { cn } from "@/lib/utils";

function Bone({ className }: { className?: string }) {
  return <span className={cn("inline-block animate-pulse rounded bg-foreground/10", className)} />;
}

/** Compact skeleton matching the collapsed quote details control. */
export function QuoteSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-lg border border-border bg-[var(--panel-elevated)] px-4 py-3",
        className,
      )}
      aria-busy="true"
      aria-label="Loading quote"
    >
      <Bone className="h-4 w-20" />
      <Bone className="h-4 w-4 rounded-full" />
    </div>
  );
}
