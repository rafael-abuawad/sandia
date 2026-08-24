import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type FieldSkeletonProps = {
  className?: string;
  labelClassName?: string;
  controlClassName?: string;
  help?: boolean;
};

export function FieldSkeleton({
  className,
  labelClassName,
  controlClassName,
  help = false,
}: FieldSkeletonProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <Skeleton className={cn("h-4 w-24", labelClassName)} />
      <Skeleton className={cn("h-11 w-full sm:h-10", controlClassName)} />
      {help ? <Skeleton className="h-3 w-2/3" /> : null}
    </div>
  );
}
