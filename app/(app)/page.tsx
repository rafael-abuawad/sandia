import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="pr-stack pr-page--hero mx-auto">
      <section className="pr-panel pr-panel--hero pr-animate-in">
        <div className="relative max-w-2xl space-y-6">
          <p className="pr-eyebrow pr-animate-in">Payrequest</p>
          <h1 className="pr-display pr-animate-in pr-animate-in-delay-1 text-3xl sm:text-5xl">
            Request dollars. Receive USDG on Robinhood Chain.
          </h1>
          <p className="pr-lede pr-animate-in pr-animate-in-delay-2">
            Create a payment link or send USDG. Switch modes from the navigation to get started.
          </p>
          <div className="pr-animate-in pr-animate-in-delay-3 flex flex-wrap gap-3 pt-2">
            <Button asChild size="lg">
              <Link href="/requests/new">Create a request</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/send">Send USDG</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/dashboard">Your requests</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="pr-grid-3">
        {[
          {
            title: "Request",
            body: "Create a USD payment link. Payers settle from their own chain, and USDG arrives on Robinhood Chain. No Payrequest account required.",
          },
          {
            title: "Send",
            body: "Push USDG to one recipient or a batch, with a review step before anything is sent.",
          },
          {
            title: "Stocks and earn",
            body: "Stock trades and vault deposits appear only after a live quote or vault call says they are open.",
          },
        ].map((item) => (
          <div key={item.title} className="pr-feature">
            <h2 className="pr-feature-title">{item.title}</h2>
            <p>{item.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
