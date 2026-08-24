import { Badge } from "@/components/ui/badge";

const STATUS_VARIANT: Record<string, "accent" | "warning" | "success" | "neutral" | "danger"> = {
  open: "accent",
  pending: "warning",
  submitted: "warning",
  refunded: "warning",
  completed: "success",
  filled: "success",
  expired: "neutral",
  cancelled: "neutral",
  failed: "danger",
};

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  pending: "Bridging",
  submitted: "Submitted",
  filled: "Complete",
  completed: "Paid",
  expired: "Expired",
  cancelled: "Cancelled",
  failed: "Failed",
  refunded: "Refunded",
};

export function StatusBadge({ status }: { status: string }) {
  const key = status.toLowerCase();
  return <Badge variant={STATUS_VARIANT[key] ?? "accent"}>{STATUS_LABEL[key] ?? status}</Badge>;
}
