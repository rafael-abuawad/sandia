import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="pr-stack mx-auto max-w-4xl">
      <section className="pr-panel pr-panel--hero pr-animate-in">
        <div className="relative max-w-2xl space-y-6">
          <p className="pr-eyebrow pr-animate-in">Payrequest</p>
          <h1 className="pr-display pr-animate-in pr-animate-in-delay-1 text-3xl sm:text-5xl">
            Request dollars. Receive stablecoins on Robinhood Chain.
          </h1>
          <p className="pr-lede pr-animate-in pr-animate-in-delay-2">
            Create a payment link, send funds, or settle OTC. Switch modes from the navigation to get
            started.
          </p>
          <div className="pr-animate-in pr-animate-in-delay-3 flex flex-wrap gap-3 pt-2">
            <Button asChild size="lg">
              <Link href="/requests/new">Request</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/send">Send</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/otc">OTC</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="pr-grid-3">
        {[
          {
            title: "Request",
            body: "Create a USD payment link. Payers connect a wallet and settle via Across — no account required.",
          },
          {
            title: "Send",
            body: "Push funds to a recipient with the same settlement rails and destination clarity.",
          },
          {
            title: "OTC",
            body: "Settle peer-to-peer deals with the same request and pay flow primitives.",
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
