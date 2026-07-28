import { SendForm } from "@/components/send-form";

export default function SendPage() {
  return (
    <div className="space-y-6">
      <div className="mx-auto max-w-lg space-y-2">
        <h1 className="pr-display text-2xl">Send</h1>
        <p className="text-sm leading-relaxed text-muted">
          Demo send — choose a single recipient or a massive batch with per-address amounts. The
          batch transfer contract is coming soon; this flow validates and reviews only.
        </p>
      </div>
      <SendForm />
    </div>
  );
}
