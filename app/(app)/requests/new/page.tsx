import { CreateRequestForm } from "@/components/create-request-form";

export default function NewRequestPage() {
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="space-y-2">
        <h1 className="pr-display text-2xl">New payment request</h1>
        <p className="text-sm text-muted">
          Destination is always USDG on Robinhood Chain (Across).
        </p>
      </div>
      <CreateRequestForm />
    </div>
  );
}
