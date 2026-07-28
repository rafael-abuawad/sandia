import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  open: "border-transparent bg-[var(--accent-soft)] text-[var(--accent-ink)]",
  pending: "border-transparent bg-[var(--warning-soft)] text-warning",
  completed: "border-transparent bg-[var(--info-soft)] text-info",
  expired: "border-transparent bg-foreground/5 text-muted",
  cancelled: "border-transparent bg-foreground/5 text-muted",
  failed: "border-transparent bg-[var(--danger-soft)] text-danger",
  submitted: "border-transparent bg-[var(--warning-soft)] text-warning",
  filled: "border-transparent bg-[var(--info-soft)] text-info",
  refunded: "border-transparent bg-[var(--warning-soft)] text-warning",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge className={cn("capitalize", STATUS_STYLES[status] ?? STATUS_STYLES.open)}>
      {status}
    </Badge>
  );
}
