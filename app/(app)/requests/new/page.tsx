import { CreateRequestForm } from "@/components/create-request-form";

export default function NewRequestPage() {
  return (
    <div className="pr-page">
      <div className="space-y-2">
        <h1 className="pr-display text-2xl">New payment request</h1>
        <p className="text-sm text-muted">
          Recipients get USDG on Robinhood Chain. Payers can send from another chain.
        </p>
      </div>
      <CreateRequestForm />
    </div>
  );
}
