import { Badge } from "@/components/ui/badge";

const STATUS_VARIANT: Record<string, "accent" | "warning" | "success" | "neutral" | "danger"> = {
  open: "accent",
  pending: "warning",
  submitted: "warning",
  refunded: "warning",
  completed: "success",
  filled: "success",
  settled: "success",
  processing: "warning",
  awaiting_deposit: "accent",
  expired: "neutral",
  cancelled: "neutral",
  failed: "danger",
};

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  pending: "Processing",
  submitted: "Submitted",
  filled: "Complete",
  settled: "Complete",
  processing: "Processing",
  awaiting_deposit: "Awaiting deposit",
  completed: "Complete",
  expired: "Expired",
  cancelled: "Cancelled",
  failed: "Failed",
  refunded: "Refunded",
  ignored_duplicate: "Duplicate",
};

export function statusLabel(status: string): string {
  const key = status.toLowerCase();
  return STATUS_LABEL[key] ?? "Unknown";
}

export function StatusBadge({ status }: { status: string }) {
  const key = status.toLowerCase();
  return <Badge variant={STATUS_VARIANT[key] ?? "neutral"}>{statusLabel(status)}</Badge>;
}
