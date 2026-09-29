import { formatUsdFromMicros } from "@/lib/money";
import type { ReviewPayload } from "@/components/send-form/state";

export function SendSummaryDetails({ review }: { review: ReviewPayload }) {
  return (
    <dl className="space-y-2 text-sm">
      <div className="flex justify-between gap-4">
        <dt className="text-muted">Mode</dt>
        <dd className="font-medium capitalize">{review.mode}</dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt className="text-muted">Recipients</dt>
        <dd className="font-medium">{review.recipients.length}</dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt className="text-muted">Total</dt>
        <dd className="pr-mono font-medium">{formatUsdFromMicros(review.totalUsdMicros)} USDG</dd>
      </div>
    </dl>
  );
}
